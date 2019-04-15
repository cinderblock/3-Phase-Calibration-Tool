import { createReadStream } from 'fs';
import readline from 'readline';

import { DataPoint } from '../DataPoint';

import { DataFormat } from './DataFormat';

export default async function loadDataFromCSV(file: string): Promise<DataFormat> {
  console.log('Loading file:', file);
  return new Promise((resolve, reject) => {
    const forward: DataPoint[] = [];
    const reverse: DataPoint[] = [];

    console.log('Making read stream');

    const fileStream = createReadStream(file);

    console.log('Created read stream');

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    console.log('Created readline interface');

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

      const [step, alpha, dir, x, y, z, current, temperature, AS, BS, CS, AIN0, VG] = split;

      // Header
      if (Number.isNaN(step)) return;

      (dir > 0 ? forward : reverse)[step] = {
        alpha,
        x: x & 0x2000 ? x | (-1 & ~0x3fff) : x & 0x3fff,
        y: y & 0x2000 ? y | (-1 & ~0x3fff) : y & 0x3fff,
        z: z & 0x2000 ? z | (-1 & ~0x3fff) : z & 0x3fff,
        current,
        temperature,
        AS,
        BS,
        CS,
        VG,
      };
    });

    rl.on('close', () => {
      console.log('close');
      resolve({ forward, reverse, time });
    });

    rl.on('error', reject);
  });
}
