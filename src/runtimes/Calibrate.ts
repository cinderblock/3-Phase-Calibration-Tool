'use strict';

import { addAttachListener } from 'smooth-control';
import { v1 as uuid } from 'uuid';
import processData from '../processes/Calibration';
import { createWriteStream } from 'fs';
import { EOL } from 'os';
import DataIDBlock from '../processes/DataIDBlock';
import chalk from 'chalk';
import { DataFormat } from '../loaders/DataFormat';
import * as CLI from '../utils/CLI';
import loadDataFromCSV from '../loaders/DataFile';
import loadDataFromUSB from '../loaders/LiveUSB';
import ForceQuit from '../utils/ForceQuit';

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

const chartWidth = 600;
const chartHeight = chartWidth;

const cyclesPerRev = 15;
const revolutions = 3;

// TODO: Load from smooth-control
const cycle = 3 * 256;

const maxAmplitude = 65;

async function main() {
  let def = 'None';
  let rePrompt = false;

  CLI.onSIGINT(() => ForceQuit(400));

  const rawDataFilename = (await CLI.prompt('Data file? [data.csv]: ')).trim() || 'data.csv';

  const fresh = (await CLI.prompt('Capture fresh? [No]: ')).trim().toLowerCase()[0] == 'y';

  console.log('Fresh:', fresh);

  let data: Promise<DataFormat>;

  let resultSerial: string;

  if (!fresh) {
    resultSerial = uuid();

    resultSerial = (await CLI.prompt(`New serial number [${resultSerial}]: `)).trim() || resultSerial;

    CLI.close();

    console.log('serial:', resultSerial);

    data = loadDataFromCSV(rawDataFilename);
  } else {
    console.log('Cycles per Rev:', cyclesPerRev);
    console.log('Revolutions:', revolutions);
    console.log('Amplitude:', maxAmplitude);

    const stopListening = await addAttachListener(id => {
      console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
      def = id;
      if (rePrompt) console.log(`Serial Number [${def}]: `);
    });

    rePrompt = true;

    const selectedSerial = (await CLI.prompt(`Serial Number [${def}]: `)).trim() || def;

    stopListening();

    resultSerial = selectedSerial;
    if (resultSerial == 'None') {
      resultSerial = uuid();

      resultSerial = (await CLI.prompt(`New serial number [${resultSerial}]: `)).trim() || resultSerial;
    } else {
      console.log('Storing calibration data as:', resultSerial);
    }

    const logger = createWriteStream(rawDataFilename);

    logger.write('step,alpha,dir,x,y,z,current,cpuTemp,AS,BS,CS,ain0,VG' + EOL);

    data = loadDataFromUSB(selectedSerial, cyclesPerRev, revolutions, maxAmplitude, (step, dir, data) => {
      logger.write(
        `${step},${data.alpha},${dir},${data.x},${data.y},${data.z},${data.current},${data.temperature},${data.AS},${
          data.BS
        },${data.CS},,${data.VG}${EOL}`
      );
    });

    data.then(({ time }) => {
      logger.end(`${time.valueOf()}${EOL}`);
    });
  }

  console.log('Loading data');

  // Await the actual loading of data from file or USB
  const { forward, reverse, time } = await data;

  CLI.close();

  console.log('Data loaded');

  // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
  const processed = processData(forward.map(d => d.alpha), reverse.map(d => d.alpha), cyclesPerRev * cycle);

  const block = DataIDBlock({
    lookupTable: processed.inverseTable,
    calibrationTime: time,
    serial: resultSerial,
  });

  console.log('Done recording. Generating outputs.');

  async function finishedMessage(p: Promise<void>, note: string) {
    await p;
    console.log('Wrote', note);
  }

  await Promise.all([
    // finishedMessage(writeRawDataToPNG('data.png', processed, 800), 'Raw PNG'),
    finishedMessage(writeRawXYZToPNG('xyzData.png', forward, 2000, 1400), 'XYZ Raw'),
    finishedMessage(writeScaledXYZToPNG('xyzScaled.png', forward, 2000, 1400), 'XYZ Scaled'),
    finishedMessage(writeFixedXYZToPNG('xyzFixed.png', forward, 2000, 1400), 'XYZ Fixed'),
    finishedMessage(writeXYPlotToPNG('xyPlot.png', forward, 2000, 1400), 'XY Circle'),
    // finishedMessage(writeVGToPNG('vgData.png', forward, 2000, 200), 'VG PNG'),
    // finishedMessage(writeSortedDataToFile('Reordered Original Data.csv', processed),'Sorted Data'),
    // finishedMessage(writeSmoothedDataToFile('Smoothed.csv', processed),'Smoothed Data'),
    // finishedMessage(writeSmoothedDataToPNG('Smoothed.png', processed, 1000),'Smoothed PNG'),
    finishedMessage(writeLookupTableToPNG('Lookup Table.png', processed, 1000), 'Lookup Table PNG'),
    finishedMessage(writeCalibrationBlock(resultSerial + '.hex', block), 'HEX Block'),
  ]);

  console.log('done');

  ForceQuit(500);
}

main();
