import USBInterface, {
  MLXCommand,
  ReadData,
  addAttachListener,
  CommandMode,
  MlxResponseState,
} from 'smooth-control';
import readline from 'readline';
import chalk from 'chalk';
import { Opcode, parseData, makePacket, EEchallenge } from 'mlx90363';

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
  let def = 'None';

  const stopListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  const usb = USBInterface(serial);

  stopListening();

  usb.events.on('status', async (s: string) => {
    if (s != 'ok') return;

    // Motor connected

    console.log('Starting');

    const mode = CommandMode.MLXDebug;
    const buff = Buffer.alloc(7);

    const command: MLXCommand = { mode, data: buff };

    function sendCommand(command: MLXCommand) {
      // console.log(command);
      return new Promise(res => usb.write(command, res));
    }

    const MAPXYZ = 0x102a;

    const eeAddr = 0x102e;

    // Prepare a memory read
    // Read same location twice for now...
    buff.writeUInt16LE(eeAddr, 0);
    buff.writeUInt16LE(eeAddr, 2);
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

      if (data && data.mlxResponseState && data.mlxResponse) {
        if (data.mlxResponseState > MlxResponseState.failedCRC) {
          result = parseData(data.mlxResponse);
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

    const eeKey = EEchallenge[(eeAddr / 2) & 0b11111];
    // const eeValue = (result.data0 & ~0b111) | +(await prompt('Mode?: ')).trim();
    let lowGain = +(await prompt('LowGain: ')).trim();

    if (lowGain > 41) lowGain = 41;
    if (lowGain < 1) lowGain = 1;

    let highGain = +(await prompt('HighGain: ')).trim();

    if (highGain > 41) highGain = 41;
    if (highGain < 1) highGain = 1;

    const eeValue = lowGain | (highGain << 8);

    if (eeValue === result.data0) {
      console.log('EEPROM already has expected value!');
      usb.close();
      rl.close();
      return;
    }

    await prompt(
      `EEWrite value: 0x${eeValue.toString(16)} to: 0x${eeAddr.toString(16)}?`
    );

    rl.close();

    command.data = makePacket({
      opcode: Opcode.EEPROMWrite,
      data8: [0, eeAddr],
      data16: [, eeKey, eeValue],
    });

    console.log('Sending EEPROM Write');

    await sendCommand(command);

    // Don't need to read response from previous command

    // Make sure MLX has some time
    await delay(10);

    command.data = makePacket({
      opcode: Opcode.EEReadChallenge,
    });

    console.log('Reading EEPROM Write challenge');
    await sendCommand(command);

    await usb.read();
    let data = await usb.read();

    if (!data || !data.mlxResponse) throw 'wtf!';

    result = parseData(data.mlxResponse);

    if (result.opcode == Opcode.EEPROMWrite_Status) {
      console.log('Wrong key. Used:', eeKey);
      throw 'Wrong Key';
    }

    console.log('EEWrite Challenge:', result);

    if (result.challengeKey === undefined) throw 'wtf2!';

    // Magic "hashing" algorithm
    const keyEcho = result.challengeKey ^ 0x1234;

    command.data = makePacket({
      opcode: Opcode.EEChallengeAns,
      data16: [, keyEcho, ~keyEcho & 0xffff],
    });

    console.log('Sending challenge response');
    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (!data || !data.mlxResponse) throw '...';

    result = parseData(data.mlxResponse);

    if (result.opcode != Opcode.EEReadAnswer) {
      console.log('Received unexpected response to EEReadChallenge from MLX');
      throw 'not ok';
    }

    console.log('Received ReadAnswer as expected');

    // Only need tEEWrite, which is 1ms, but whatever
    await delay(100);

    command.data = makePacket({ opcode: Opcode.NOP__Challenge });

    console.log('Sending NOP to retrieve EEWrite status');
    await sendCommand(command);

    await usb.read();
    data = await usb.read();

    if (!data || !data.mlxResponse) throw 'wtf';

    result = parseData(data.mlxResponse);
    console.log('EE Write result:', result);

    if (result.opcode != Opcode.EEPROMWrite_Status) throw 'Ugh';

    if (result.code === 1) console.log('EEPROM Write successful!');

    command.data = makePacket({ opcode: Opcode.Reboot });

    console.log('Rebooting MLX');
    await sendCommand(command);

    usb.close();
  });

  // Actually start looking for the usb device without automatic polling
  usb.start(false);
}

main();
