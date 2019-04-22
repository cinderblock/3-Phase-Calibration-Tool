'use strict';

import { v1 as uuid } from 'uuid';
import DataIDBlock from '../processes/DataIDBlock';
import * as CLI from '../utils/CLI';
import writeLookupTableToPNG from '../outputs/images/Lookup';
import writeCalibrationBlock from '../outputs/CalibrationBlock';
import { createReadStream } from 'fs';
import readline from 'readline';

// TODO: Load from smooth-control
const cycle = 3 * 256;

export default async function main(file: string) {
  console.log('Loading file:', file);

  const id = uuid();
  const serial = (await CLI.prompt('New Serial [' + id + ']:')).trim() || id;

  console.log('Using serial:', serial);

  const inputDate = (await CLI.prompt('Calibration Date [now]:')).trim();

  CLI.close();

  const calibrationTime = inputDate ? new Date(inputDate) : new Date();

  const lookupTable = await readTable(file);

  const revolutions = lookupTable.reduce((revs, pos) => Math.max(revs, Math.floor(pos / cycle)), 0) + 1;

  console.log('Detected revolutions:', revolutions);

  const dummy: number[] = [];

  await Promise.all([
    writeLookupTableToPNG(
      'Lookup Table.png',
      {
        inverseTable: lookupTable,
        forward: dummy,
        middle: dummy,
        reverse: dummy,
        forwardData: dummy,
        reverseData: dummy,
      },
      revolutions
    ),
    writeCalibrationBlock(serial + '.hex', DataIDBlock({ lookupTable, calibrationTime, serial })),
  ]);

  console.log('Done');
}

async function readTable(file: string): Promise<number[]> {
  return new Promise(async (resolve, reject) => {
    const readStream = createReadStream(file);
    const rl = readline.createInterface(readStream);
    const result: number[] = [];
    const expectedLength = 2 ** 12;

    rl.on('line', l => {
      l.split(/[^0-9oxb]+/)
        // Filter empty strings and other bad values
        .filter(s => s)
        // This even handles base prefixed number strings
        .forEach(n => result.push(Number(n)));
    });

    rl.on('close', () => {
      if (result.length != expectedLength) {
        reject('Incorrect number of elements read');
      } else {
        console.log('done!');
        resolve(result);
      }

      // Is this necessary?
      readStream.close();
    });
  });
}

if (require.main === module) {
  const file = process.argv[2];
  if (file) main(file);
  else {
    console.log('Must specify filename at command line');
  }
}
