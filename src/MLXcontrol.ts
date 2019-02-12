import USBInterface, {
  MLXCommand,
  ReadData,
  addAttachListener,
  CommandMode,
  MlxResponseState,
} from './USBInterface';
import readline from 'readline';
import chalk from 'chalk';
import {
  CRC,
  Opcode,
  parseMLXData,
  makeMLXPacket,
  EECode,
  EEchallenge,
} from './MLX90363';

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
    const buff = Buffer.alloc(7);

    const command: MLXCommand = { mode, data: buff };

    function sendCommand(command: MLXCommand) {
      return new Promise(res => usb.write(command, res));
    }

    const MAPXYZ = 0x102a;

    const addr = MAPXYZ;

    // Prepare a memory read
    // Read same location twice for now...
    buff.writeUInt16LE(addr, 0);
    buff.writeUInt16LE(addr, 2);
    buff[6] = 0b11000000 | Opcode.MemoryRead;

    let result;

    await sendCommand(command);

    await delay(1);

    while (true) {
      await sendCommand(command);
      // Read once extra to force AVR to update internal data
      await usb.read();
      const data = await usb.read();

      const halfSecWaitMinimum = delay(500);

      if (data) {
        if (data.mlxResponseState > MlxResponseState.failedCRC) {
          result = parseMLXData(data.mlxResponse);
          if (result.data0 !== undefined) break;
          else console.log('Received unexpected response:', result);
        } else console.log('CRC Invalid on device?');
      } else console.log('Response missing?');
      let v;
      if ((v = (await prompt('Again? ')).trim())) {
        buff[0] = parseInt(v, 16);
      }

      await halfSecWaitMinimum;
    }

    console.log(result);

    await prompt('EEWrite?');

    const eeAddr = MAPXYZ;
    const eeKey = EEchallenge[(MAPXYZ / 2) & 0b11111];
    const eeValue = 49664;

    command.data = makeMLXPacket({
      opcode: Opcode.EEPROMWrite,
      data8: [0, MAPXYZ],
      data16: [, eeKey, eeValue],
    });

    await sendCommand(command);

    await delay(1);

    command.data = makeMLXPacket({
      opcode: Opcode.EEReadChallenge,
    });

    await sendCommand(command);

    await usb.read();
    let data = await usb.read();

    if (!data) throw 'wtf!';

    result = parseMLXData(data.mlxResponse);

    console.log('EEWrite Response:', result);

    if (result.opcode == Opcode.EEPROMWrite_Status) {
      console.log('Wrong key. Used:', eeKey);
    }

    if (result.challengeKey === undefined) throw 'wtf2!';

    const keyEcho = result.challengeKey ^ 0x1234;

    command.data = makeMLXPacket({
      opcode: Opcode.EEChallengeAns,
      data16: [, keyEcho, ~keyEcho & 0xffff],
    });

    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (data && parseMLXData(data.mlxResponse).opcode == Opcode.EEReadAnswer) {
      // ok
    } else throw 'not ok';

    // Only need tEEWrite, which is 1ms, but whatever
    await delay(10);

    command.data = makeMLXPacket({ opcode: Opcode.NOP__Challenge });

    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (!data) throw 'wtf';
    result = parseMLXData(data.mlxResponse);
    console.log('EE result:', result);

    if (result.opcode != Opcode.EEPROMWrite_Status) throw 'Ugh';

    command.data = makeMLXPacket({ opcode: Opcode.Reboot });
    await sendCommand(command);
  });

  // Actually start looking for the usb device without automatic polling
  usb.start(false);
}

main();
