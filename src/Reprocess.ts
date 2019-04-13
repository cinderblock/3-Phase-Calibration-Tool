'use strict';

import USB, { addAttachListener, CommandMode, MLXCommand, Command } from 'smooth-control';
import { v1 as uuid } from 'uuid';
import PositiveModulus from './utils/PositiveModulus';
import processData, { ProcessedData } from './Calibration';
import readline from 'readline';
import { createReadStream, createWriteStream, writeFileSync, readdir, lstatSync } from 'fs';
import { EOL } from 'os';
import DataIDBlock from './DataIDBlock';
import chalk from 'chalk';
import MemoryMap from 'nrf-intel-hex';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import ChartjsNode from 'chartjs-node';
import { promisify } from 'util';
import { join } from 'path';

const chartWidth = 600;

const cyclesPerRev = 15;
const revolutions = 1;

const stepSize = 1;

const cycle = 3 * 256;

const maxAmplitude = 45;

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
  rl.on('SIGINT', () => {
    setTimeout(() => {
      console.log('Forcing quit');
      process.exit(0);
    }, 400).unref();
  });

  const rawDataFilename = (await prompt('Data file? [data.csv]: ')).trim() || 'data.csv';

  let data: Promise<{
    forward: DataPoint[];
    reverse: DataPoint[];
    time: Date;
  }>;

  let serial = 'Mill Test';

  rl.close();

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
      finishedMessage(writeXYPlotToPNG(join(folder, 'xyPlot.png'), forward, 2000, 1400), 'XY Fixed'),
      // finishedMessage(writeVGToPNG(join(folder,'vgData.png'), forward, 2000, 200), 'VG PNG'),
      // finishedMessage(writeSortedDataToFile(join(folder,'Reordered Original Data.csv'), processed),'Sorted Data'),
      // finishedMessage(writeSmoothedDataToFile(join(folder,'Smoothed.csv'), processed),'Smoothed Data'),
      // finishedMessage(writeSmoothedDataToPNG(join(folder,'Smoothed.png'), processed, 1000),'Smoothed PNG'),
      // finishedMessage(writeLookupTableToPNG(join(folder,'Lookup Table.png'), processed, 1000), 'Lookup Table PNG'),
      // finishedMessage(writeCalibrationBlock(join(folder, serial + '.hex'), block), 'HEX Block'),
    ]);
  }

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

    const fileStream = createReadStream(file);

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

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
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
          pointRadius: 7,
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

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
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
          pointRadius: 7,
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

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}

async function writeFixedXYZToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = width) {
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
        // {
        //   label: 'Z',
        //   yAxisID: 'XYZ',
        //   data: dataPoints.map(({ z, VG }, s) => ({ x: s, y: z / VG })),
        //   backgroundColor: '#0000ff',
        // },
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
          pointRadius: 7,
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
              min: -120,
              max: 120,
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

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}

async function writeXYPlotToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'XY',
          yAxisID: 'Y',
          data: dataPoints.map(({ x, y, VG }) => ({ x: x / VG, y: y / VG })),
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
              labelString: 'Scaled X',
            },
            type: 'linear',
            ticks: {
              min: -150,
              max: 150,
            },
          },
        ],
        yAxes: [
          {
            id: 'Y',
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Scaled Y',
            },
            type: 'linear',
            ticks: {
              min: -150,
              max: 150,
            },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}

async function writeVGToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = 100) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Gain',
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

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
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

  await chartNode.writeImageToFile('image/png', './Smoothed.png');

  chartNode.destroy();
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

  await await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}

function percent(x: number) {
  return Math.round(x * 100) + '%';
}
