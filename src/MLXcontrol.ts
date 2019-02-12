import USBInterface, {
  MLXCommand,
  ReadData,
  addAttachListener,
  CommandMode,
} from './USBInterface';
import readline from 'readline';
import chalk from 'chalk';
import mlxCRC from './mlxCRC';

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    rl.question(prompt, resolve);
  });
}

enum Marker {
  Alpha,
  AlphaBeta,
  XYZ,
  Opcode,
}
enum Opcode {
  // Following the format from the datasheet, they organized all the opcodes as
  // Outgoing      or       Incoming
  GET1 = 0x13,
  GET2 = 0x14,
  GET3 = 0x15,
  Get3Ready = 0x2d,
  MemoryRead = 0x01,
  MemoryRead_Answer = 0x02,
  EEPROMWrite = 0x03,
  EEPROMWrite_Challenge = 0x04,
  EEChallengeAns = 0x05,
  EEReadAnswer = 0x28,
  EEReadChallenge = 0x0f,
  EEPROMWrite_Status = 0x0e,
  NOP__Challenge = 0x10,
  Challenge__NOP_MISO_Packet = 0x11,
  DiagnosticDetails = 0x16,
  Diagnostics_Answer = 0x17,
  OscCounterStart = 0x18,
  OscCounterStart_Acknowledge = 0x19,
  OscCounterStop = 0x1a,
  OscCounterStopAck_CounterValue = 0x1b,
  Reboot = 0x2f,
  Standby = 0x31,
  StandbyAck = 0x32,
  Error_frame = 0x3d,
  NothingToTransmit = 0x3e,
  Ready_Message = 0x2c,
}
enum DiagnosticStatus {
  Init,
  Fail,
  Pass,
  PassNew,
}
enum ErrorCode {
  IncorrectBitCount = 1,
  IncorrectCRC = 2,
  NTT = 3,
  OpcodeNotValid = 4,
}
enum EECode {
  Success = 1,
  WriteFail = 2,
  CRCWriteFail = 4,
  KeyInvalid = 6,
  CallengeFail = 7,
  OddAddress = 8,
}

function parseMLXData(data: Buffer) {
  const crc = mlxCRC(data);

  const marker: Marker = data[6] >> 6;
  const roll = data[6] & 0b111111;

  // Only valid for "normal" messages
  const diagnosticStatus: DiagnosticStatus = data[1] >> 6;

  switch (marker) {
    case Marker.Alpha:
      return {
        crc,
        roll,
        marker,
        vg: data[4],
        alpha: data.readUInt16LE(0) & 0x3fff,
        diagnosticStatus,
      };
    case Marker.AlphaBeta:
      return {
        crc,
        roll,
        marker,
        vg: data[4],
        alpha: data.readUInt16LE(0) & 0x3fff,
        beta: data.readUInt16LE(2) & 0x3fff,
        diagnosticStatus,
      };
    case Marker.XYZ:
      return {
        crc,
        roll,
        marker,
        x: data.readInt16LE(0) & 0x3fff,
        y: data.readInt16LE(2) & 0x3fff,
        z: data.readInt16LE(4) & 0x3fff,
        diagnosticStatus,
      };
    case Marker.Opcode:
      const opcode: Opcode = roll;
      switch (opcode) {
        case Opcode.GET1:
        case Opcode.GET2:
        case Opcode.GET3:
        case Opcode.MemoryRead:
        case Opcode.EEPROMWrite:
        case Opcode.EEChallengeAns:
        case Opcode.EEReadChallenge:
        case Opcode.NOP__Challenge:
        case Opcode.DiagnosticDetails:
        case Opcode.OscCounterStart:
        case Opcode.OscCounterStop:
        case Opcode.Reboot:
        case Opcode.Standby:
          // TODO: Parse these instead of throwing
          throw 'This is data sent TO device...';

        case Opcode.Get3Ready:
          throw 'Not yet implmented';
          return { crc, opcode, marker };

        case Opcode.MemoryRead_Answer:
          return {
            crc,
            opcode,
            marker,
            data0: data.readUInt16LE(0),
            data1: data.readUInt16LE(2),
          };

        case Opcode.EEPROMWrite_Challenge:
          return { crc, opcode, marker, challengeKey: data.readUInt16LE(2) };

        case Opcode.EEReadAnswer:
          return { crc, opcode, marker };

        case Opcode.EEPROMWrite_Status:
          const code: EECode = data[0];
          return { crc, opcode, marker, code };

        case Opcode.Challenge__NOP_MISO_Packet:
          return {
            crc,
            opcode,
            marker,
            key: data.readInt16LE(2),
            invertedKey: data.readInt16LE(4),
          };

        case Opcode.Diagnostics_Answer:
        case Opcode.OscCounterStart_Acknowledge:
        case Opcode.OscCounterStopAck_CounterValue:
        case Opcode.StandbyAck:
          throw 'Not yet implmented';
          return { crc, opcode, marker };

        case Opcode.Error_frame:
          const error: ErrorCode = data[0];
          return { crc, opcode, marker, error };

        case Opcode.NothingToTransmit:
          return { crc, opcode, marker };

        case Opcode.Ready_Message:
          return {
            crc,
            opcode,
            marker,
            hwVersion: data[0],
            fwVersion: data[1],
          };

        default:
          throw 'Invalid Opcode';
      }
  }
}

async function main() {
  await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
  });

  const serial = (await prompt('Serial Number [None]: ')).trim() || 'None';
  const usb = USBInterface(serial);

  usb.events.on('status', async (s: string) => {
    if (s != 'ok') return;

    // Motor connected

    console.log('Starting');

    const mode = CommandMode.MLXDebug;
    const data = Buffer.alloc(7);

    const command: MLXCommand = { mode, data };

    const MAPXYZ = 0x102a;

    const addr = MAPXYZ;

    // Read same location twice for now...
    data.writeUInt16LE(addr, 0);
    data.writeUInt16LE(addr, 2);
    data[6] = 0b11000000 | Opcode.MemoryRead;

    let result;

    while (true) {
      await new Promise(res => usb.write(command, res));

      await delay(5);
      const data = await usb.read();

      if (data) {
        if (data.localMLXCRC) {
          result = parseMLXData(data.mlxResponse);
          if (result.data0 !== undefined && false) break;
          else console.log('Received unexpected response:', result);
        } else console.log('CRC Invalid on device?');
      } else console.log('Response missing?');
      await prompt('Again? ');
    }

    console.log(result);

    await prompt('EEWrite?');
    usb.write(command);
  });

  // Actually start looking for the usb device without automatic polling
  usb.start(false);
}

main();
