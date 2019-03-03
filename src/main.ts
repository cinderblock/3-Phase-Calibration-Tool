'use strict';

import USB, {
  addAttachListener,
  CommandMode,
  MLXCommand,
  Command,
  ReadData,
} from './USBInterface';
import PositiveModulus from './PositiveModulus';
import processData, { ProcessedData } from './Calibration';
import readline from 'readline';
import { createReadStream, createWriteStream, writeFileSync } from 'fs';
import { EOL } from 'os';
import DataIDBlock from './DataIDBlock';
import chalk from 'chalk';
import MemoryMap from 'nrf-intel-hex';
import { makeMLXPacket, Opcode, Marker, ErrorCode } from './MLX90363';
import ChartjsNode from 'chartjs-node';

const chartWidth = 600;
const chartHeight = chartWidth;

const cyclePerRev = 15;
const Revs = 4;

const cycle = 3 * 256;

const maxAmplitude = 50;

const rawDataFilename = 'data.csv';

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

  const stopListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  stopListening();

  const data =
    (await prompt('Capture fresh? [No]: ')).trim().toLowerCase()[0] == 'y'
      ? loadDataFromUSB(serial, cyclePerRev, Revs)
      : loadDataFromCSV(rawDataFilename);

  rl.close();

  const { forward, reverse, time } = await data;

  // Take raw forward/reverse calibration data and calculate smoothed, averaged, and inverted
  const processed = processData(forward, reverse, cyclePerRev * cycle);

  const block = DataIDBlock({
    lookupTable: processed.inverseTable,
    calibrationTime: time,
    serial: serial,
  });

  console.log('Done recording. Generating outputs.');

  await Promise.all([
    writeRawDataToPNG('data.png', processed).then(() =>
      console.log('Raw PNG Written')
    ),
    // writeSortedDataToFile('Reordered Original Data.csv', processed).then(() => console.log('Sorted Data Written')),
    // writeSmoothedDataToFile('Smoothed.csv', processed).then(() => console.log('Smoothed Data Written')),
    // writeSmoothedDataToPNG('Smoothed.png', processed).then(() => console.log('Smoothed PNG Written')),
    writeLookupTableToPNG('Lookup Table.png', processed).then(() =>
      console.log('Lookup Table PNG Written')
    ),
    writeCalibrationBlock(serial + '.hex', block).then(() =>
      console.log('HEX Block Written')
    ),
  ]);

  console.log('done');
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

    const logger = createWriteStream(rawDataFilename);
    const loggerXYZ = createWriteStream('XYZ' + rawDataFilename);

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
      return new Promise(res => {
        try {
          usb.write(command, res);
        } catch (e) {
          console.log('not Sent because:', e);
          res();
        }
      });
    }

    let errors = 0;
    setInterval(() => {
      errors -= 0.1;
    }, 100);
    function maybeThrow(message: String) {
      errors++;
      if (errors < 5) {
        console.error('Error suppressed:', message);
        return;
      }
      throw message;
    }

    usb.events.once('status', async (s: string) => {
      if (s != 'ok') return;

      // Motor connected

      console.log('Starting');

      while (true) {
        await sendCommand(GetAlpha);
        // Give sensor time to make reading
        await delay(2);
        await sendCommand(GetXYZ);

        const xyzDelay = delay(1);

        // Force AVR USB to update USB buffer data once
        let data = await usb.read();

        do {
          data = await usb.read();
          if (!data) throw 'Data missing';
        } while (!data.mlxParsedResponse);

        if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
          console.log(
            'Error frame. Error:',
            data.mlxParsedResponse.error === undefined
              ? 'undefined??'
              : ErrorCode[data.mlxParsedResponse.error]
          );
          maybeThrow('Received Error Frame');
          continue;
        }

        if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
          maybeThrow('Nothing to transmit');
          continue;
        }

        if (data.mlxParsedResponse.alpha === undefined)
          throw 'Parsing failure? - Alpha';

        const { alpha } = data.mlxParsedResponse;

        (dir > 0 ? forward : reverse)[step] = alpha;

        await xyzDelay;

        await sendCommand(MLXNOP);

        // Force AVR USB to update USB buffer data once
        let dataXYZ = await usb.read();

        do {
          dataXYZ = await usb.read();
          if (!dataXYZ) throw 'XYZ data missing';
        } while (!dataXYZ.mlxParsedResponse);

        if (dataXYZ.mlxParsedResponse.opcode == Opcode.Error_frame) {
          console.log(
            'Error frame. Error:',
            dataXYZ.mlxParsedResponse.error === undefined
              ? 'undefined??'
              : ErrorCode[dataXYZ.mlxParsedResponse.error]
          );
          maybeThrow('Received Error Frame XYZ');
          continue;
        }

        if (dataXYZ.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
          maybeThrow('Nothing to transmit XYZ');
          continue;
        }

        const { x, y, z } = dataXYZ.mlxParsedResponse;

        if (x === undefined) throw 'Parsing failure? - x';
        if (y === undefined) throw 'Parsing failure? - y';
        if (z === undefined) throw 'Parsing failure? - z';

        // Only record data in range of good motion
        if (step >= 0 && step < End) {
          logger.write(`${step},${alpha},${dir}${EOL}`);
          loggerXYZ.write(`${step},${dir},${x},${y},${z},${alpha}${EOL}`);
        }

        // Keep going one cycle past the End before turning around
        if (dir > 0 && step > End + cycle / 2) {
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

async function writeSortedDataToFile(
  filename: string,
  processed: ProcessedData
) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse' + EOL);
  for (let i = 0; i < processed.forwardData.length; i++) {
    out.write(
      `${i},${processed.forwardData[i]},${processed.reverseData[i]}${EOL}`
    );
  }
  out.close();
}

async function writeRawDataToPNG(filename: string, processed: ProcessedData) {
  const chartNode = new ChartjsNode(chartWidth, chartHeight);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Forward',
          data: processed.forwardData.map((y, x) => ({ x, y })),
        },
        {
          label: 'Reverse',
          data: processed.reverseData.map((y, x) => ({ x, y })),
        },
      ],
    },
    options: {
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  chartNode.writeImageToFile('image/png', './data.png');
}

async function writeSmoothedDataToFile(
  filename: string,
  processed: ProcessedData
) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse,middle' + EOL);
  for (let i = 0; i < processed.forward.length; i++) {
    out.write(
      `${i},${processed.forward[i]},${processed.reverse[i]},${
        processed.middle[i]
      }${EOL}`
    );
  }
  out.close();
}

async function writeSmoothedDataToPNG(
  filename: string,
  processed: ProcessedData
) {
  const chartNode = new ChartjsNode(chartWidth, chartHeight);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Forward',
          data: processed.forward.map((y, x) => ({ x, y })),
        },
        {
          label: 'Reverse',
          data: processed.reverse.map((y, x) => ({ x, y })),
        },
        {
          label: 'Middle',
          data: processed.middle.map((y, x) => ({ x, y })),
        },
      ],
    },
    options: {
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  chartNode.writeImageToFile('image/png', './Smoothed.png');
}

async function writeCalibrationBlock(filename: string, block: Buffer) {
  const mem = new MemoryMap();

  mem.set(0x4f80, block);

  writeFileSync(filename, mem.asHexString().replace(/\n/g, EOL) + EOL);
}

async function writeLookupTableToPNG(
  filename: string,
  processed: ProcessedData
) {
  const chartNode = new ChartjsNode(chartWidth, chartHeight);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Lookup',
          data: processed.inverseTable.map((y, x) => ({ x, y })),
        },
      ],
    },
    options: {
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);
}
