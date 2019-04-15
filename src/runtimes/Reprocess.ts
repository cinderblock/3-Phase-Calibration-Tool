'use strict';

import { promisify } from 'util';
import { join } from 'path';
import { readdir, lstatSync } from 'fs';

import processData, { ProcessedData } from '../processes/Calibration';
import DataIDBlock from '../processes/DataIDBlock';
import { DataFormat } from '../loaders/DataFormat';
import * as CLI from '../utils/CLI';
import loadDataFromCSV from '../loaders/DataFile';
import ForceQuit from '../utils/ForceQuit';

import writeRawXYZToPNG from '../outputs/images/XYZ/Raw';
import writeScaledXYZToPNG from '../outputs/images/XYZ/Scaled';
import writeVGToPNG from '../outputs/images/VG';
import writeFixedXYZToPNG from '../outputs/images/XYZ/Fixed';
import writeXYPlotToPNG from '../outputs/images/XYCircles';
import writeSortedDataToFile from '../outputs/csv/Sorted';
import writeSmoothedDataToFile from '../outputs/csv/Smoothed';
import writeSmoothedDataToPNG from '../outputs/images/Smoothed';
import writeLookupTableToPNG from '../outputs/images/Lookup';
import writeCalibrationBlock from '../outputs/CalibrationBlock';
import writeRawDataToPNG from '../outputs/images/Raw';

const chartWidth = 600;

const cyclesPerRev = 15;

const cycle = 3 * 256;

async function main() {
  CLI.onSIGINT(() => ForceQuit(400));

  const rawDataFilename = (await CLI.prompt('Data file? [data.csv]: ')).trim() || 'data.csv';

  let data: Promise<DataFormat>;

  let serial = 'Mill Test';

  CLI.close();

  const folders = (await promisify(readdir)('mill-table'))
    .map(f => join('mill-table', f))
    .filter(f => lstatSync(f).isDirectory());

  for (const folder of folders) {
    data = loadDataFromCSV(join(folder, rawDataFilename));

    // Await the actual loading of data from file or USB
    const { forward, reverse, time } = await data;

    // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
    const processed = processData(forward.map(d => d.alpha), reverse.map(d => d.alpha), cyclesPerRev * cycle);

    const block = DataIDBlock({
      lookupTable: processed.inverseTable,
      calibrationTime: time,
      serial: serial,
    });

    async function finishedMessage(p: Promise<void>, note: string) {
      await p;
      console.log('Wrote', note);
    }

    await Promise.all([
      // finishedMessage(writeRawDataToPNG(join(folder,'data.png'), processed, 800), 'Raw PNG'),
      // finishedMessage(writeRawXYZToPNG(join(folder,'xyzData.png'), forward, 2000, 1400), 'XYZ Raw'),
      // finishedMessage(writeScaledXYZToPNG(join(folder,'xyzScaled.png'), forward, 2000, 1400), 'XYZ Scaled'),
      finishedMessage(writeFixedXYZToPNG(join(folder, 'xyzFixed.png'), forward, 2000, 1400), 'XYZ Fixed'),
      finishedMessage(writeXYPlotToPNG(join(folder, 'xyPlot.png'), forward, 2000, 1400), 'XY Circle'),
      // finishedMessage(writeVGToPNG(join(folder,'vgData.png'), forward, 2000, 200), 'VG PNG'),
      // finishedMessage(writeSortedDataToFile(join(folder,'Reordered Original Data.csv'), processed),'Sorted Data'),
      // finishedMessage(writeSmoothedDataToFile(join(folder,'Smoothed.csv'), processed),'Smoothed Data'),
      // finishedMessage(writeSmoothedDataToPNG(join(folder,'Smoothed.png'), processed, 1000),'Smoothed PNG'),
      // finishedMessage(writeLookupTableToPNG(join(folder,'Lookup Table.png'), processed, 1000), 'Lookup Table PNG'),
      // finishedMessage(writeCalibrationBlock(join(folder, serial + '.hex'), block), 'HEX Block'),
    ]);
  }

  console.log('done');

  ForceQuit(500);
}

main();
