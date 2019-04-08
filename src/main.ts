'use strict';

import USB, { addAttachListener, CommandMode, MLXCommand, Command } from 'smooth-control';
import { v1 as uuid } from 'uuid';
import PositiveModulus from './utils/PositiveModulus';
import processData, { ProcessedData } from './Calibration';
import readline from 'readline';
import { createReadStream, createWriteStream, writeFileSync } from 'fs';
import { EOL } from 'os';
import DataIDBlock from './DataIDBlock';
import chalk from 'chalk';
import MemoryMap from 'nrf-intel-hex';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import ChartjsNode from 'chartjs-node';

const chartWidth = 600;
const chartHeight = chartWidth;

const cyclesPerRev = 15;
const revolutions = 4;

const stepSize = 1;

const cycle = 3 * 256;

const maxAmplitude = 50;

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
  let rePrompt = false;

  rl.on('SIGINT', () => {
    setTimeout(() => {
      console.log('Forcing quit');
      process.exit(0);
    }, 400).unref();
  });

  const rawDataFilename = (await prompt('Data file? [data.csv]: ')).trim() || 'data.csv';

  const fresh = (await prompt('Capture fresh? [No]: ')).trim().toLowerCase()[0] == 'y';

  console.log('Fresh:', fresh);

  let data: Promise<{
    forward: DataPoint[];
    reverse: DataPoint[];
    time: Date;
  }>;

  let resultSerial: string;

  if (!fresh) {
    resultSerial = uuid();

    resultSerial = (await prompt(`New serial number [${resultSerial}]: `)).trim() || resultSerial;

    rl.close();

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

    const selectedSerial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

    resultSerial = selectedSerial;
    if (resultSerial == 'None') {
      resultSerial = uuid();

      resultSerial = (await prompt(`New serial number [${resultSerial}]: `)).trim() || resultSerial;
    } else {
      console.log('Storing calibration data as:', resultSerial);
    }

    stopListening();

    const logger = createWriteStream(rawDataFilename);

    logger.write('step,alpha,dir,x,y,z,current,cpuTemp,AS,BS,CS,ain0,VG' + EOL);

    data = loadDataFromUSB(selectedSerial, cyclesPerRev, revolutions, (step, dir, data) => {
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

  rl.close();

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
    // finishedMessage(writeVGToPNG('vgData.png', forward, 2000, 200), 'VG PNG'),
    // finishedMessage(writeSortedDataToFile('Reordered Original Data.csv', processed),'Sorted Data'),
    // finishedMessage(writeSmoothedDataToFile('Smoothed.csv', processed),'Smoothed Data'),
    // finishedMessage(writeSmoothedDataToPNG('Smoothed.png', processed, 1000),'Smoothed PNG'),
    finishedMessage(writeLookupTableToPNG('Lookup Table.png', processed, 1000), 'Lookup Table PNG'),
    finishedMessage(writeCalibrationBlock(resultSerial + '.hex', block), 'HEX Block'),
  ]);

  console.log('done');

  setTimeout(() => {
    console.log('Force killing');
    process.kill(0);
  }, 500).unref();
}

main();

type DataPoint = {
  alpha: number;
  x: number;
  y: number;
  z: number;
  current: number;
  temperature: number;
  AS: number;
  BS: number;
  CS: number;
  VG: number;
};

async function loadDataFromCSV(
  file: string
): Promise<{
  forward: DataPoint[];
  reverse: DataPoint[];
  time: Date;
}> {
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
        x,
        y,
        z,
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

async function loadDataFromUSB(
  serial: string,
  cyclePerRev: number,
  revolutions: number,
  logger: (step: number, dir: number, data: DataPoint) => void
): Promise<{
  forward: DataPoint[];
  reverse: DataPoint[];
  time: Date;
}> {
  return new Promise((resolve, reject) => {
    const forward: DataPoint[] = [];
    const reverse: DataPoint[] = [];
    const usb = USB(serial);

    // Non-inclusive last step of calibration routine
    const End = cycle * cyclePerRev * revolutions;

    const mode = CommandMode.Calibration;

    // Running smoothed version of alpha value
    let alpha: number;

    // Current calibration direction
    let dir = stepSize;

    // Ramp amplitude up slowly
    let amplitude = 0;

    // Start below "0" to give mechanics time to settle
    let step = -cycle;

    const GetAlpha: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({
        opcode: Opcode.GET1,
        marker: Marker.Alpha,
        data16: [, 0xffff],
      }),
    };
    const GetXYZ: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({
        opcode: Opcode.GET1,
        marker: Marker.XYZ,
        data16: [, 0xffff],
      }),
    };
    const MLXNOP: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({ opcode: Opcode.NOP__Challenge }),
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
      if (errors < 50) {
        console.error('Error suppressed:', message);
        return;
      }
      throw message;
    }

    usb.events.once('status', async (s: string) => {
      if (s != 'ok') return;

      // Motor connected

      console.log('Starting');

      let lastPrint;

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

        if (!data.mlxParsedResponse.crc) {
          maybeThrow('data crc fail');
          continue;
        }

        if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
          console.log(
            'Error frame. Error:',
            data.mlxParsedResponse.error === undefined ? 'undefined??' : ErrorCode[data.mlxParsedResponse.error]
          );
          maybeThrow('Received Error Frame');
          continue;
        }

        if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
          maybeThrow('Nothing to transmit');
          continue;
        }

        if (data.mlxParsedResponse.alpha === undefined) throw 'Parsing failure? - Alpha';

        const { current, cpuTemp: temperature, AS, BS, CS } = data;

        const { alpha, vg: VG } = data.mlxParsedResponse;

        await xyzDelay;

        await sendCommand(MLXNOP);

        // Force AVR USB to update USB buffer data once
        let dataXYZ = await usb.read();

        do {
          dataXYZ = await usb.read();
          if (!dataXYZ) throw 'XYZ data missing';
        } while (!dataXYZ.mlxParsedResponse);

        if (!dataXYZ.mlxParsedResponse.crc) {
          maybeThrow('dataxyz crc fail');
          continue;
        }

        if (dataXYZ.mlxParsedResponse.opcode == Opcode.Error_frame) {
          console.log(
            'Error frame. Error:',
            dataXYZ.mlxParsedResponse.error === undefined ? 'undefined??' : ErrorCode[dataXYZ.mlxParsedResponse.error]
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
          (dir > 0 ? forward : reverse)[step] = {
            alpha,
            x,
            y,
            z,
            current,
            temperature,
            AS,
            BS,
            CS,
            VG,
          };

          logger(step, dir, {
            alpha,
            x,
            y,
            z,
            current,
            temperature,
            AS,
            BS,
            CS,
            VG,
          });
        }

        // Keep going one cycle past the End before turning around
        if (dir > 0 && step > End + cycle / 2) {
          console.log('Reversing');
          dir = -dir;
        }

        // All done
        if (dir < 0 && step <= 0) {
          const time = new Date();

          usb.write({ mode, amplitude: 0, angle: 0 }, () => {
            usb.close();
          });

          resolve({ forward, reverse, time });
          usb.close();
          break;
        }

        // Normal step
        step += dir;

        // Ramp amplitude up
        if (amplitude < maxAmplitude) amplitude++;

        const angle = PositiveModulus(step, cycle);

        // Print status updates at logarithmic periods
        const temp = Math.round(Math.log(999 + step || 1) / Math.log(1.1));
        if (temp !== lastPrint) {
          console.log(
            'At step:',
            step,
            percent(step / End),
            'mag:',
            alpha,
            'Temp:',
            data.cpuTemp,
            'Current:',
            data.current,
            'VG:',
            VG
          );
          lastPrint = temp;
        }

        await sendCommand({ mode, amplitude, angle });
      }
    });

    // Actually start looking for the usb device
    usb.start(false);
  });
}

async function writeSortedDataToFile(filename: string, processed: ProcessedData) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse' + EOL);
  for (let i = 0; i < processed.forwardData.length; i++) {
    out.write(`${i},${processed.forwardData[i]},${processed.reverseData[i]}${EOL}`);
  }
  out.close();
}

async function writeRawDataToPNG(filename: string, processed: ProcessedData, width = 600, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Forward',
          data: processed.forwardData.map((y, x) => ({ x, y })),
          // backgroundColor: '#00ff00',
          backgroundColor: '#00ff00',
        },
        {
          label: 'Reverse',
          data: processed.reverseData.map((y, x) => ({ x, y })),
          backgroundColor: '#ff0000',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
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

  chartNode.writeImageToFile('image/png', filename);
}

async function writeRawXYZToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'X',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ x }, s) => ({ x: s, y: x })),
          backgroundColor: '#ff0000',
        },
        {
          label: 'Y',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ y }, s) => ({ x: s, y: y })),
          backgroundColor: '#00ff00',
        },
        {
          label: 'Z',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ z }, s) => ({ x: s, y: z })),
          backgroundColor: '#0000ff',
        },
        {
          label: 'Gain',
          yAxisID: 'VG',
          data: dataPoints.map(({ VG }, s) => ({ x: s, y: VG })),
          backgroundColor: '#000000',
        },
        {
          label: 'Alpha',
          yAxisID: 'Alpha',
          data: dataPoints.map(({ alpha }, s) => ({ x: s, y: alpha })),
          backgroundColor: '#e541f4',
        },
        {
          label: 'Angle',
          yAxisID: 'Angle',
          data: dataPoints.map(({ x, y }, s) => ({
            x: s,
            // y: (Math.atan2(-y, -x) / (Math.PI * 2) + 0.5) * 2 ** 14,
            y: Math.atan2(-y, -x),
          })),
          backgroundColor: '#fff45b',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
        yAxes: [
          {
            id: 'XYZ',
            scaleLabel: { fontSize: 24, display: true, labelString: 'Raw XYZ' },
            type: 'linear',
            position: 'left',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'VG',
            scaleLabel: { fontSize: 24, display: true, labelString: 'Gain' },
            type: 'linear',
            position: 'right',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'Alpha',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: 0, max: 2 ** 14 },
          },
          {
            id: 'Angle',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: -Math.PI, max: Math.PI },
          },
        ],
      },
    },
  });

  chartNode.writeImageToFile('image/png', filename);
}

async function writeScaledXYZToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'X',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ x, VG }, s) => ({ x: s, y: x / VG })),
          backgroundColor: '#ff0000',
        },
        {
          label: 'Y',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ y, VG }, s) => ({ x: s, y: y / VG })),
          backgroundColor: '#00ff00',
        },
        {
          label: 'Z',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ z, VG }, s) => ({ x: s, y: z / VG })),
          backgroundColor: '#0000ff',
        },
        {
          label: 'VG',
          yAxisID: 'VG',
          data: dataPoints.map(({ VG }, s) => ({ x: s, y: VG })),
          backgroundColor: '#000000',
        },
        {
          label: 'Alpha',
          yAxisID: 'Alpha',
          data: dataPoints.map(({ alpha }, s) => ({ x: s, y: alpha })),
          backgroundColor: '#e541f4',
        },
        {
          label: 'Angle',
          yAxisID: 'Angle',
          data: dataPoints.map(({ x, y }, s) => ({
            x: s,
            // y: (Math.atan2(-y, -x) / (Math.PI * 2) + 0.5) * 2 ** 14,
            y: Math.atan2(-y, -x),
          })),
          backgroundColor: '#fff45b',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
        yAxes: [
          {
            id: 'XYZ',
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Scaled XYZ',
            },
            type: 'linear',
            position: 'left',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'VG',
            scaleLabel: { fontSize: 24, display: true, labelString: 'Gain' },
            type: 'linear',
            position: 'right',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'Alpha',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: 0, max: 2 ** 14 },
          },
          {
            id: 'Angle',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: -Math.PI, max: Math.PI },
          },
        ],
      },
    },
  });

  chartNode.writeImageToFile('image/png', filename);
}

async function writeVGToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = 100) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'VG',
          data: dataPoints.map(({ VG }, s) => ({ x: s, y: VG })),
          backgroundColor: '#000000',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
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

  chartNode.writeImageToFile('image/png', filename);
}

async function writeSmoothedDataToFile(filename: string, processed: ProcessedData) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse,middle' + EOL);
  for (let i = 0; i < processed.forward.length; i++) {
    out.write(`${i},${processed.forward[i]},${processed.reverse[i]},${processed.middle[i]}${EOL}`);
  }
  out.close();
}

async function writeSmoothedDataToPNG(filename: string, processed: ProcessedData, width = 400, height = width) {
  const chartNode = new ChartjsNode(width, height);
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
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
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

async function writeLookupTableToPNG(filename: string, processed: ProcessedData, width = 400, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Lookup',
          data: processed.inverseTable.map((y, x) => ({ x, y })),
          backgroundColor: '#000000',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Alpha / 4',
            },
            type: 'linear',
            ticks: {
              stepSize: 2 ** 9,
            },
          },
        ],
        yAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);
}

function percent(x: number) {
  return Math.round(x * 100) + '%';
}
