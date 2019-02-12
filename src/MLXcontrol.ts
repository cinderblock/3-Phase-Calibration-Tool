import USBInterface, {
  MLXCommand,
  ReadData,
  addAttachListener,
  CommandMode,
  MlxResponseState,
} from './USBInterface';
import readline from 'readline';
import chalk from 'chalk';
import { Opcode, parseMLXData, makeMLXPacket, EEchallenge } from './MLX90363';

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

    const eeKey = EEchallenge[(MAPXYZ / 2) & 0b11111];
    const eeValue = (result.data0 & ~0b11) | 1;

    if (eeValue === result.data0) {
      console.log('EEPROM already has expected value!');
      return;
    }

    await prompt(
      `EEWrite value: 0x${eeValue.toString(16)} to: 0x${addr.toString(16)}?`
    );

    command.data = makeMLXPacket({
      opcode: Opcode.EEPROMWrite,
      data8: [0, addr],
      data16: [, eeKey, eeValue],
    });

    console.log('Sending EEPROM Write');

    await sendCommand(command);

    // Don't need to read response from previous command

    // Make sure MLX has some time
    await delay(10);

    command.data = makeMLXPacket({
      opcode: Opcode.EEReadChallenge,
    });

    console.log('Reading EEPROM Write challenge');
    await sendCommand(command);

    await usb.read();
    let data = await usb.read();

    if (!data) throw 'wtf!';

    result = parseMLXData(data.mlxResponse);

    if (result.opcode == Opcode.EEPROMWrite_Status) {
      console.log('Wrong key. Used:', eeKey);
      throw 'Wrong Key';
    }

    console.log('EEWrite Challenge:', result);

    if (result.challengeKey === undefined) throw 'wtf2!';

    // Magic "hashing" algorithm
    const keyEcho = result.challengeKey ^ 0x1234;

    command.data = makeMLXPacket({
      opcode: Opcode.EEChallengeAns,
      data16: [, keyEcho, ~keyEcho & 0xffff],
    });

    console.log('Sending challenge response');
    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (!data) throw '...';

    result = parseMLXData(data.mlxResponse);

    if (result.opcode != Opcode.EEReadAnswer) {
      console.log('Received unexpected response to EEReadChallenge from MLX');
      throw 'not ok';
    }

    console.log('Received ReadAnswer as expected');

    // Only need tEEWrite, which is 1ms, but whatever
    await delay(100);

    command.data = makeMLXPacket({ opcode: Opcode.NOP__Challenge });

    console.log('Sending NOP to retrieve EEWrite status');
    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (!data) throw 'wtf';

    result = parseMLXData(data.mlxResponse);
    console.log('EE Write result:', result);

    if (result.opcode != Opcode.EEPROMWrite_Status) throw 'Ugh';

    if (result.code === 1) console.log('EEPROM Write successful!');

    command.data = makeMLXPacket({ opcode: Opcode.Reboot });

    console.log('Rebooting MLX');
    await sendCommand(command);

    usb.close();
  });

  // Actually start looking for the usb device without automatic polling
  usb.start(false);
}

main();
