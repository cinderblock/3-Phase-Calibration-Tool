'use strict';

import { v1 as uuid } from 'uuid';
import DataIDBlock from '../processes/DataIDBlock';
import * as CLI from '../utils/CLI';
import writeLookupTableToPNG from '../outputs/images/Lookup';
import writeCalibrationBlock from '../outputs/CalibrationBlock';

// TODO: Load from smooth-control
const cycle = 3 * 256;

export default async function main() {
  const id = uuid();
  const serial = (await CLI.prompt('New Serial [' + id + ']:')).trim() || id;

  console.log('Using serial:', serial);

  const inputDate = (await CLI.prompt('Calibration Date [now]:')).trim();

  CLI.close();

  const calibrationTime = inputDate ? new Date(inputDate) : new Date();

  const lookupTable = await readTable();

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

async function readTable(): Promise<number[]> {
  return new Promise(async (resolve, reject) => {
    const result: number[] = [];

    while (result.length < 2 ** 12) {
      (await CLI.prompt('Data:'))
        .trim()
        .split(/[^0-9oxb]/)
        .filter(s => s != '')
        // This even handles base prefixed number strings
        .map(Number)
        .forEach(n => result.push(n));
    }

    if (result.length != 2 ** 12) {
      reject('Incorrect number of elements read');
    } else {
      resolve(result);
    }
  });
}

if (require.main === module) main();
