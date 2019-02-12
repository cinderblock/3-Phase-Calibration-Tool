const cba_256_TAB = [
  0x00,
  0x2f,
  0x5e,
  0x71,
  0xbc,
  0x93,
  0xe2,
  0xcd,
  0x57,
  0x78,
  0x09,
  0x26,
  0xeb,
  0xc4,
  0xb5,
  0x9a,
  0xae,
  0x81,
  0xf0,
  0xdf,
  0x12,
  0x3d,
  0x4c,
  0x63,
  0xf9,
  0xd6,
  0xa7,
  0x88,
  0x45,
  0x6a,
  0x1b,
  0x34,
  0x73,
  0x5c,
  0x2d,
  0x02,
  0xcf,
  0xe0,
  0x91,
  0xbe,
  0x24,
  0x0b,
  0x7a,
  0x55,
  0x98,
  0xb7,
  0xc6,
  0xe9,
  0xdd,
  0xf2,
  0x83,
  0xac,
  0x61,
  0x4e,
  0x3f,
  0x10,
  0x8a,
  0xa5,
  0xd4,
  0xfb,
  0x36,
  0x19,
  0x68,
  0x47,
  0xe6,
  0xc9,
  0xb8,
  0x97,
  0x5a,
  0x75,
  0x04,
  0x2b,
  0xb1,
  0x9e,
  0xef,
  0xc0,
  0x0d,
  0x22,
  0x53,
  0x7c,
  0x48,
  0x67,
  0x16,
  0x39,
  0xf4,
  0xdb,
  0xaa,
  0x85,
  0x1f,
  0x30,
  0x41,
  0x6e,
  0xa3,
  0x8c,
  0xfd,
  0xd2,
  0x95,
  0xba,
  0xcb,
  0xe4,
  0x29,
  0x06,
  0x77,
  0x58,
  0xc2,
  0xed,
  0x9c,
  0xb3,
  0x7e,
  0x51,
  0x20,
  0x0f,
  0x3b,
  0x14,
  0x65,
  0x4a,
  0x87,
  0xa8,
  0xd9,
  0xf6,
  0x6c,
  0x43,
  0x32,
  0x1d,
  0xd0,
  0xff,
  0x8e,
  0xa1,
  0xe3,
  0xcc,
  0xbd,
  0x92,
  0x5f,
  0x70,
  0x01,
  0x2e,
  0xb4,
  0x9b,
  0xea,
  0xc5,
  0x08,
  0x27,
  0x56,
  0x79,
  0x4d,
  0x62,
  0x13,
  0x3c,
  0xf1,
  0xde,
  0xaf,
  0x80,
  0x1a,
  0x35,
  0x44,
  0x6b,
  0xa6,
  0x89,
  0xf8,
  0xd7,
  0x90,
  0xbf,
  0xce,
  0xe1,
  0x2c,
  0x03,
  0x72,
  0x5d,
  0xc7,
  0xe8,
  0x99,
  0xb6,
  0x7b,
  0x54,
  0x25,
  0x0a,
  0x3e,
  0x11,
  0x60,
  0x4f,
  0x82,
  0xad,
  0xdc,
  0xf3,
  0x69,
  0x46,
  0x37,
  0x18,
  0xd5,
  0xfa,
  0x8b,
  0xa4,
  0x05,
  0x2a,
  0x5b,
  0x74,
  0xb9,
  0x96,
  0xe7,
  0xc8,
  0x52,
  0x7d,
  0x0c,
  0x23,
  0xee,
  0xc1,
  0xb0,
  0x9f,
  0xab,
  0x84,
  0xf5,
  0xda,
  0x17,
  0x38,
  0x49,
  0x66,
  0xfc,
  0xd3,
  0xa2,
  0x8d,
  0x40,
  0x6f,
  0x1e,
  0x31,
  0x76,
  0x59,
  0x28,
  0x07,
  0xca,
  0xe5,
  0x94,
  0xbb,
  0x21,
  0x0e,
  0x7f,
  0x50,
  0x9d,
  0xb2,
  0xc3,
  0xec,
  0xd8,
  0xf7,
  0x86,
  0xa9,
  0x64,
  0x4b,
  0x3a,
  0x15,
  0x8f,
  0xa0,
  0xd1,
  0xfe,
  0x33,
  0x1c,
  0x6d,
  0x42,
];

export const EEchallenge = [
  17485,
  31053,
  57190,
  57724,
  7899,
  53543,
  26763,
  12528,
  38105,
  51302,
  16209,
  24847,
  13134,
  52339,
  14530,
  18350,
  55636,
  64477,
  40905,
  45498,
  24411,
  36677,
  4213,
  48843,
  6368,
  5907,
  31384,
  63325,
  3562,
  19816,
  6995,
  3147,
];

export function CRC(data: Buffer) {
  if (data.length != 8) throw 'InvalidLength';

  let crc = 0xff;
  for (let i = 0; i < 7; i++) crc = cba_256_TAB[data[i] ^ crc];

  return ~crc & 0xff;
}

export enum Marker {
  Alpha,
  AlphaBeta,
  XYZ,
  Opcode,
}
export enum Opcode {
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
export enum DiagnosticStatus {
  Init,
  Fail,
  Pass,
  PassNew,
}
export enum ErrorCode {
  IncorrectBitCount = 1,
  IncorrectCRC = 2,
  NTT = 3,
  OpcodeNotValid = 4,
}
export enum EECode {
  Success = 1,
  WriteFail = 2,
  CRCWriteFail = 4,
  KeyInvalid = 6,
  CallengeFail = 7,
  OddAddress = 8,
}

export function parseMLXData(data: Buffer) {
  const crc = CRC(data) == data[7];

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
          throw 'Not yet implemented';
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
          throw 'Not yet implemented';
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

export type MLXPacket = {
  opcode: Opcode;
  data8?: (undefined | number)[];
  data16?: (undefined | number)[];
};

export function makeMLXPacket(data: MLXPacket) {
  const ret = Buffer.alloc(8);

  if (data.data8)
    data.data8.forEach((n, i) => {
      if (n !== undefined) ret[i] = n;
    });

  if (data.data16)
    data.data16.forEach((n, i) => {
      if (n !== undefined) ret.writeUInt16LE(n, i * 2);
    });

  ret[6] = 0b11000000 | data.opcode;

  ret[7] = CRC(ret);
  return ret;
}
