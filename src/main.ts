'use strict';

import USB, { Command } from './USBInterface';

import ExponentialFilter from './ExponentialFilter';
import PositiveModulus from './PositiveModulus';
import processData from './Calibration';
import readline from 'readline';
import { createReadStream, createWriteStream } from 'fs';
import { EOL } from 'os';
import DataIDBlock from './DataIDBlock';

const cyclePerRev = 15;
const Revs = 4;

const cycle = 3 * 256;

const maxAmplitude = 30;

const filename = 'data.csv';

let Serial: string;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Serial Number (default: generate UUIDv1): ', answer => {
  Serial = answer.trim();
  rl.close();
});

const data = loadDataFromUSB('None', cyclePerRev, Revs);
// const data = loadDataFromSSV(filename)

data.then(async ({ forward, reverse, time }) => {
  // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
  const processed = processData(forward, reverse, cyclePerRev * cycle);

  const data = DataIDBlock({
    lookupTable: processed.inverseTable,
    calibrationTime: time,
    serial: Serial,
  });

  console.log('done');
});

async function loadDataFromSSV(
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
      const split = line.split(' ').map(parseInt);

      // Get date from solo column
      if (split.length < 3) {
        time = new Date(split[0]);
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

    logger.write('step,alpha,dir');

    // Non-inclusive last step of calibration routine
    const End = cycle * cyclePerRev * revolutions;

    const mode = 'Calibration';

    // Running smoothed version of alpha value
    let currentAngle: number;

    // Current calibration direction
    let dir = 1;

    // Ramp amplitude up slowly
    let amplitude = 0;

    // Start below "0" to give mechanics time to settle
    let step = -cycle;

    // Smooth data from motor since we're getting MLX readings constantly.
    // TODO: Make this circular... This is wrong during alpha wrap.
    const filter = ExponentialFilter(0.1);

    usb.events.on(
      'data',
      (data: { status: string; fault: string; rawAngle: number }) => {
        // Top bit specifies if device already thinks it is calibrated
        data.rawAngle &= (1 << 14) - 1;
        currentAngle = filter(data.rawAngle);
      }
    );

    usb.events.on('status', (s: string) => {
      if (s != 'ok') return;

      // Motor connected

      console.log('Starting');

      const i = setInterval(async () => {
        if (currentAngle === undefined) {
          console.log('Have not yet received MLX data...');
          return;
        }

        // Only record data in range of good motion
        if (step >= 0 && step < End) {
          (dir > 0 ? forward : reverse)[step] = currentAngle;

          logger.write(`${step},${currentAngle},${dir}${EOL}`);
        }

        // Keep going one cycle past the End before turning around
        if (dir > 0 && step > End + cycle) {
          console.log('Reversing');
          dir = -dir;
        }

        // All done
        if (dir < 0 && step <= 0) {
          clearInterval(i);

          const time = new Date();

          // Write to file as ms since Unix epoch
          logger.end(time.valueOf() + EOL);

          usb.write({ mode, amplitude: 0, angle: 0 }, () => {
            usb.close();
          });

          resolve({ forward, reverse, time });
          return;
        }

        // Normal step
        step += dir;

        // Ramp amplitude up
        if (amplitude < maxAmplitude) amplitude++;

        const angle = PositiveModulus(step, cycle);

        usb.write({ mode, amplitude, angle });
      }, 7);
    });

    // Actually start looking for the usb device
    usb.start();
  });
}
