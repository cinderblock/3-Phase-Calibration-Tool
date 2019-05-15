'use strict';

import { addAttachListener, start } from 'smooth-control';
import { v1 as uuid } from 'uuid';
import { createWriteStream } from 'fs';
import { EOL } from 'os';
import chalk from 'chalk';
import { DataFormat } from '../loaders/DataFormat';
import * as CLI from '../utils/CLI';
import loadDataFromCSV from '../loaders/DataFile';
import loadDataFromUSB from '../loaders/LiveUSB';
import ForceQuit from '../utils/ForceQuit';
import DataOutputs from '../processes/DataOutputs';

const chartWidth = 600;
const chartHeight = chartWidth;

const cyclesPerRev = 15;
const revolutions = 3;

const maxAmplitude = 65;

async function main() {
  let def = 'None';
  let rePrompt = false;

  const sigintCleanup = CLI.onSIGINT(() => ForceQuit(400));

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

    start();

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
  await data;

  console.log('Data loaded. Generating outputs.');

  await DataOutputs(resultSerial, data, cyclesPerRev);

  console.log('done');

  sigintCleanup();
  CLI.close();

  ForceQuit(500);
}

main();
