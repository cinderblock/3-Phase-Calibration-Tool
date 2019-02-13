'use strict';

import USB, {
  addAttachListener,
  CommandMode,
  MLXCommand,
  Command,
} from './USBInterface';

import ExponentialFilter from './ExponentialFilter';
import PositiveModulus from './PositiveModulus';
import processData from './Calibration';
import readline from 'readline';
import { createReadStream, createWriteStream, writeFileSync } from 'fs';
import { EOL } from 'os';
import DataIDBlock from './DataIDBlock';
import chalk from 'chalk';
import MemoryMap from 'nrf-intel-hex';
import { parseMLXData, makeMLXPacket, Opcode, Marker } from './MLX90363';

const cyclePerRev = 15;
const Revs = 4;

const cycle = 3 * 256;

const maxAmplitude = 30;

const filename = 'data.csv';

const RecordXYZAlso = true;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prompt(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  let def = 'None';

  await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  const data =
    (await prompt('Capture fresh? [No]: ')).trim().toLowerCase()[0] == 'y'
      ? loadDataFromUSB(serial, cyclePerRev, Revs)
      : loadDataFromCSV(filename);

  const { forward, reverse, time } = await data;
  // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
  const processed = processData(forward, reverse, cyclePerRev * cycle);

  const block = DataIDBlock({
    lookupTable: processed.inverseTable,
    calibrationTime: time,
    serial: serial,
  });

  let out = createWriteStream('record.csv');
  out.write('step,forward,reverse' + EOL);
  for (let i = 0; i < processed.forwardData.length; i++) {
    out.write(
      `${i},${processed.forwardData[i]},${processed.reverseData[i]}${EOL}`
    );
  }
  out.close();
  out = createWriteStream('fit.csv');
  out.write('step,forward,reverse,middle' + EOL);
  for (let i = 0; i < processed.forward.length; i++) {
    out.write(
      `${i},${processed.forward[i]},${processed.reverse[i]},${
        processed.middle[i]
      }${EOL}`
    );
  }
  out.close();

  const mem = new MemoryMap();

  mem.set(0x4f80, block);

  writeFileSync(serial + '.hex', mem.asHexString().replace(/\n/g, EOL) + EOL);

  console.log('done');

  rl.close();
}

main();

async function loadDataFromCSV(
  file: string
): Promise<{
  forward: number[];
  reverse: number[];
  time: Date;
}> {
  return new Promise((resolve, reject) => {
    const forward: number[] = [];
    const reverse: number[] = [];

    const fileStream = createReadStream(file);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Default to now if data file is missing timestamp
    let time = new Date();

    rl.on('line', (line: string) => {
      // console.log(lineCount, line, byteCount);
      const split = line.split(',').map(parseFloat);

      // Get date from solo column
      if (split.length < 3) {
        time = new Date(split[0]);
        console.log('Calibration time:', time);
        return;
      }

      const [step, val, dir] = split;

      // Header
      if (Number.isNaN(step)) return;

      (dir > 0 ? forward : reverse)[step] = val;
    });

    rl.on('close', function() {
      resolve({ forward, reverse, time });
    });

    rl.on('error', reject);
  });
}

async function loadDataFromUSB(
  serial: string,
  cyclePerRev: number,
  revolutions: number
): Promise<{
  forward: number[];
  reverse: number[];
  time: Date;
}> {
  return new Promise((resolve, reject) => {
    const forward: number[] = [];
    const reverse: number[] = [];
    const usb = USB(serial);

    const logger = createWriteStream(filename);
    const loggerXYZ = createWriteStream('XYZ' + filename);

    logger.write('step,alpha,dir' + EOL);
    loggerXYZ.write('step,dir,x,y,z,alpha' + EOL);

    // Non-inclusive last step of calibration routine
    const End = cycle * cyclePerRev * revolutions;

    const mode = CommandMode.Calibration;

    // Running smoothed version of alpha value
    let alpha: number;

    // Current calibration direction
    let dir = 1;

    // Ramp amplitude up slowly
    let amplitude = 0;

    // Start below "0" to give mechanics time to settle
    let step = -cycle;

    const GetAlpha: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makeMLXPacket({
        opcode: Opcode.GET1,
        marker: Marker.Alpha,
        data16: [, 0xffff],
      }),
    };
    const GetXYZ: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makeMLXPacket({
        opcode: Opcode.GET1,
        marker: Marker.XYZ,
        data16: [, 0xffff],
      }),
    };
    const MLXNOP: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makeMLXPacket({ opcode: Opcode.NOP__Challenge }),
    };

    function sendCommand(command: Command) {
      return new Promise(res => usb.write(command, res));
    }

    usb.events.on('status', async (s: string) => {
      if (s != 'ok') return;

      // Motor connected

      console.log('Starting');

      while (true) {
        // Only record data in range of good motion
        if (step >= 0 && step < End) {
          await sendCommand(GetAlpha);
          // Give sensor time to make reading
          await delay(2);
          await sendCommand(GetXYZ);

          const xyzDelay = delay(2);

          await usb.read();
          const data = await usb.read();
          if (!data) throw 'Data missing';

          if (!data.mlxParsedResponse) {
            console.log('Response not parsable');
            continue;
          }

          if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
            console.log('Error frame. Error:', data.mlxParsedResponse.error);
            throw 'Received Error Frame';
          }

          if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
            throw 'Nothing to transmit';
          }

          const { alpha } = data.mlxParsedResponse;

          (dir > 0 ? forward : reverse)[step] = alpha;

          await xyzDelay;

          await sendCommand(MLXNOP);
          await delay(2);

          await usb.read();
          const dataXYZ = await usb.read();
          if (!dataXYZ) throw 'Data missing';

          if (!dataXYZ.mlxParsedResponse) {
            console.log('Response not parsable');
            continue;
          }

          const { x, y, z } = dataXYZ.mlxParsedResponse;

          logger.write(`${step},${alpha},${dir}${EOL}`);
          loggerXYZ.write(`${step},${dir},${x},${y},${z},${alpha}${EOL}`);
        }

        // Keep going one cycle past the End before turning around
        if (dir > 0 && step > End + cycle) {
          console.log('Reversing');
          dir = -dir;
        }

        // All done
        if (dir < 0 && step <= 0) {
          const time = new Date();

          // Write to file as ms since Unix epoch
          logger.end(time.valueOf() + EOL);
          loggerXYZ.end();

          usb.write({ mode, amplitude: 0, angle: 0 }, () => {
            usb.close();
          });

          resolve({ forward, reverse, time });
          break;
        }

        // Normal step
        step += dir;

        // Ramp amplitude up
        if (amplitude < maxAmplitude) amplitude++;

        const angle = PositiveModulus(step, cycle);

        await sendCommand({ mode, amplitude, angle });
      }
    });

    // Actually start looking for the usb device
    usb.start(false);
  });
}
