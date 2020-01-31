import USBInterface, {
  MLXCommand,
  addAttachListener,
  CommandMode,
  MlxResponseState,
  start,
  isManualState,
} from 'smooth-control';
import readline from 'readline';
import chalk from 'chalk';
import {
  IncomingOpcode,
  OutgoingOpcode,
  parseData,
  makePacket,
  EEchallenge,
  Marker,
  Messages,
  NamedEEMemoryLocations,
} from 'mlx90363';

function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(prompt: string): Promise<string> {
  return new Promise<string>(resolve => {
    rl.question(prompt, resolve);
  });
}

async function main(): Promise<void> {
  let def = 'None';

  start();

  const stopListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  const usb = USBInterface(serial, { polling: false });

  stopListening();

  const once = usb.onStatus(async s => {
    if (s != 'connected') return;
    once();

    // Motor connected

    console.log('Starting');

    const mode = CommandMode.MLXDebug;
    const buff = Buffer.alloc(7);

    const command: MLXCommand = { mode, data: buff };

    function sendCommand(command: MLXCommand): Promise<void> {
      // console.log(command);
      const res = usb.write(command);

      if (!res) throw new Error('Disconnected?');

      return res as Promise<void>;
    }

    const loc = NamedEEMemoryLocations.VIRTUALGAINMAX;

    // Prepare a memory read
    // Read same location twice for now...
    buff.writeUInt16LE(loc, 0);
    buff.writeUInt16LE(loc, 2);
    buff[6] = 0b11000000 | OutgoingOpcode.MemoryRead;

    let result: Messages;

    await sendCommand(command);

    await delay(1);

    while (true) {
      await sendCommand(command);
      // Read once extra to force AVR to update internal data
      await usb.read();
      const data = await usb.read();

      const halfSecWaitMinimum = delay(500);

      if (data && isManualState(data) && data.mlxDataValid && data.mlxResponseState && data.mlxResponse) {
        if (data.mlxResponseState > MlxResponseState.failedCRC) {
          result = parseData(data.mlxResponse);
          if (
            result.marker === Marker.Opcode &&
            result.opcode === IncomingOpcode.MemoryRead_Answer &&
            result.data0 !== undefined
          )
            break;
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

    const eeKey = EEchallenge[(loc / 2) & 0b11111];
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

    await prompt(`EEWrite value: 0x${eeValue.toString(16)} to: 0x${loc.toString(16)}?`);

    rl.close();

    command.data = makePacket({
      opcode: OutgoingOpcode.EEPROMWrite,
      data8: [0, loc],
      data16: [, eeKey, eeValue],
    });

    console.log('Sending EEPROM Write');

    await sendCommand(command);

    // Don't need to read response from previous command

    // Make sure MLX has some time
    await delay(10);

    command.data = makePacket({
      opcode: OutgoingOpcode.EEReadChallenge,
    });

    console.log('Reading EEPROM Write challenge');
    await sendCommand(command);

    await usb.read();

    let temp = usb.read();

    if (!temp) throw new Error('Motor disconnected!');

    let data = await temp;

    if (!isManualState(data)) throw new Error('Wrong state!');
    if (!data.mlxDataValid) throw new Error('Invalid MLX data??');
    if (!data.mlxResponse) throw new Error('wtf');

    result = parseData(data.mlxResponse);

    if (result.marker !== Marker.Opcode) throw new Error('Wrong opcode?!');

    if (result.opcode == IncomingOpcode.EEPROMWrite_Status) {
      console.log('Wrong key. Used:', eeKey);
      throw new Error('Wrong Key');
    }

    if (result.opcode !== IncomingOpcode.EEPROMWrite_Challenge) throw new Error('wrong type!');

    console.log('EEWrite Challenge:', result);

    if (result.challengeKey === undefined) throw new Error('wtf2!');

    // Magic "hashing" algorithm
    const keyEcho = result.challengeKey ^ 0x1234;

    command.data = makePacket({
      opcode: OutgoingOpcode.EEChallengeAns,
      data16: [, keyEcho, ~keyEcho & 0xffff],
    });

    console.log('Sending challenge response');
    await sendCommand(command);

    await usb.read();

    temp = usb.read();

    if (!temp) throw new Error('Motor disconnected!');

    data = await temp;

    if (!isManualState(data)) throw new Error('Wrong state!');
    if (!data.mlxDataValid) throw new Error('Invalid MLX data??');
    if (!data.mlxResponse) throw new Error('wtf');

    result = parseData(data.mlxResponse);

    if (result.marker !== Marker.Opcode) throw new Error('Wrong opcode?!');

    if (result.opcode != IncomingOpcode.EEReadAnswer) {
      console.log('Received unexpected response to EEReadChallenge from MLX');
      throw new Error('not ok');
    }

    console.log('Received ReadAnswer as expected');

    // Only need tEEWrite, which is 1ms, but whatever
    await delay(100);

    command.data = makePacket({ opcode: OutgoingOpcode.NOP__Challenge });

    console.log('Sending NOP to retrieve EEWrite status');
    await sendCommand(command);

    await usb.read();

    temp = usb.read();

    if (!temp) throw new Error('Motor disconnected!');

    data = await temp;

    if (!isManualState(data)) throw new Error('Wrong state!');
    if (!data.mlxDataValid) throw new Error('Invalid MLX data??');
    if (!data.mlxResponse) throw new Error('wtf');

    result = parseData(data.mlxResponse);

    if (result.marker !== Marker.Opcode) throw new Error('Wrong opcode?!');

    console.log('EE Write result:', result);

    if (result.opcode != IncomingOpcode.EEPROMWrite_Status) throw new Error('Ugh');

    if (result.code === 1) console.log('EEPROM Write successful!');

    command.data = makePacket({ opcode: OutgoingOpcode.Reboot });

    console.log('Rebooting MLX');
    await sendCommand(command);

    // Tell the motor to run once. After we exit, motor will self reset
    await usb.write({
      mode: CommandMode.Calibration,
      amplitude: 0,
      angle: 0,
    });

    usb.close();
  });
}

main();
