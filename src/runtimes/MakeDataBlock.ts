'use strict';

import { v1 as uuid } from 'uuid';
import DataIDBlock from '../processes/DataIDBlock';
import * as CLI from '../utils/CLI';
import writeLookupTableToPNG from '../outputs/images/Lookup';
import writeCalibrationBlock from '../outputs/CalibrationBlock';

const defaultRevolutions = 7;

export default async function main() {
  let serial = uuid();
  serial = (await CLI.prompt('New Serial [' + serial + ']:')).trim() || serial;

  console.log('Using serial:', serial);

  const inputDate = (await CLI.prompt('Calibration Date [now]:')).trim();

  const revolutions =
    Number((await CLI.prompt('Revolutions [' + defaultRevolutions + ']:')).trim()) || defaultRevolutions;

  CLI.close();

  const calibrationTime = inputDate ? new Date(inputDate) : new Date();

  const lookupTable = await readTable();

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
        .split(',')
        .map(s => s.trim())
        .filter(s => s != '')
        // This even handles base prefixed number strings
        .map(Number)
        .forEach(n => result.push(n));
    }

    if (result.length != 2 ** 12) {
      reject('Incorrect number of elements read...');
    } else {
      resolve(result);
    }
  });
}

if (require.main === module) main();
