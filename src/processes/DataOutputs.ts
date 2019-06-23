import writeRawXYZToPNG from '../outputs/images/XYZ/Raw';
import writeScaledXYZToPNG from '../outputs/images/XYZ/Scaled';
import writeVGToPNG from '../outputs/images/VG';
import writeSortedDataToFile from '../outputs/csv/Sorted';
import writeSmoothedDataToFile from '../outputs/csv/Smoothed';
import writeSmoothedDataToPNG from '../outputs/images/Smoothed';
import writeLookupTableToPNG from '../outputs/images/Lookup';
import writeCalibrationBlock from '../outputs/CalibrationBlock';
import writeRawDataToPNG from '../outputs/images/Raw';
import writeFixedXYZToPNG from '../outputs/images/XYZ/Fixed';
import writeXYPlotToPNG from '../outputs/images/XYCircles';

import DataIDBlock from './DataIDBlock';
import processData from './Calibration';
import { DataFormat } from '../loaders/DataFormat';
import { join } from 'path';

// TODO: Load from smooth-control
const cycle = 3 * 256;

export default async function DataOutputs(
  serial: string,
  data: DataFormat | Promise<DataFormat>,
  cyclesPerRev: number,
  destDir?: string[]
) {
  const { forward, reverse, time } = await data;

  // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
  const processed = processData(forward.map(d => d.alpha), reverse.map(d => d.alpha), cyclesPerRev * cycle);

  const block = DataIDBlock({
    lookupTable: processed.inverseTable,
    calibrationTime: time,
    serial,
  });

  async function doneMsg(p: Promise<void>, note: string) {
    await p;
  }

  function dir(f: string) {
    return destDir ? join(...destDir, f) : f;
  }

  await Promise.all([
    // doneMsg(writeRawDataToPNG(dir('data.png'), processed, 800), 'Raw PNG'),
    doneMsg(writeRawXYZToPNG(dir('xyzData.png'), forward, 2000, 1400), 'XYZ Raw'),
    doneMsg(writeScaledXYZToPNG(dir('xyzScaled.png'), forward, 2000, 1400), 'XYZ Scaled'),
    doneMsg(writeFixedXYZToPNG(dir('xyzFixed.png'), forward, 2000, 1400), 'XYZ Fixed'),
    doneMsg(writeXYPlotToPNG(dir('xyPlot.png'), forward, 2000, 1400), 'XY Circle'),
    // doneMsg(writeVGToPNG(dir('vgData.png'), forward, 2000, 200), 'VG PNG'),
    // doneMsg(writeSortedDataToFile(dir('Reordered Original Data.csv'), processed),'Sorted Data'),
    // doneMsg(writeSmoothedDataToFile(dir('Smoothed.csv'), processed),'Smoothed Data'),
    // doneMsg(writeSmoothedDataToPNG(dir('Smoothed.png'), processed, 1000),'Smoothed PNG'),
    doneMsg(writeLookupTableToPNG(dir('Lookup Table.png'), processed, 1000), 'Lookup Table PNG'),
    doneMsg(writeCalibrationBlock(dir(serial + '.hex'), block), 'HEX Block'),
  ]);
}
