'use strict';

import USBInterface, { addAttachListener, start, MLXCommand, ReadData, CommandMode, Command } from 'smooth-control';
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
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import { delay } from '../utils/delay';
import ChartjsNode from 'chartjs-node';
import percent from '../utils/percent';

const maxAmplitude = 100;

async function prepareMotor(motor: ReturnType<typeof USBInterface>) {
  await new Promise<void>(resolve => {
    const once = motor.onStatus(status => {
      if (status != 'connected') return;
      once();
      resolve();
    });
  });

  await motor.write({ mode: CommandMode.ClearFault });
}

function getData(motor: ReturnType<typeof USBInterface>) {
  return new Promise<ReadData>(resolve => {
    const once = motor.onData(data => {
      once();
      resolve(data);
    });
  });
}

async function readDataSet(motor: ReturnType<typeof USBInterface>) {
  while (true) {
    await sendCommand(motor, GetAlpha);
    // Give sensor time to make reading
    await delay(2);
    await sendCommand(motor, GetXYZ);

    const xyzDelay = delay(1);

    // Force AVR USB to update USB buffer data once
    let data = await getData(motor);

    do {
      data = await getData(motor);
      if (!data) throw 'Data missing';
    } while (!data.mlxParsedResponse);

    if (typeof data.mlxParsedResponse == 'string') {
      maybeThrow('MLX data parsing error: ' + data.mlxParsedResponse);
      continue;
    }

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

    await sendCommand(motor, MLXNOP);

    // Force AVR USB to update USB buffer data once
    let dataXYZ = await getData(motor);

    do {
      dataXYZ = await getData(motor);
      if (!dataXYZ) throw 'XYZ data missing';
    } while (!dataXYZ.mlxParsedResponse);

    if (typeof dataXYZ.mlxParsedResponse == 'string') {
      maybeThrow('MLX data parsing error: ' + dataXYZ.mlxParsedResponse);
      continue;
    }

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

    const { x: X, y: Y, z: Z } = dataXYZ.mlxParsedResponse;

    if (X === undefined) throw 'Parsing failure? - x';
    if (Y === undefined) throw 'Parsing failure? - y';
    if (Z === undefined) throw 'Parsing failure? - z';

    return { alpha, X, Y, Z, VG, current, temperature, AS, BS, CS };
  }
}

function sendCommand(motor: ReturnType<typeof USBInterface>, command: Command) {
  return new Promise(res => {
    try {
      motor.write(command, res);
    } catch (e) {
      console.log('not Sent because:', e);
      res();
    }
  });
}

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

let errors = 0;
setInterval(() => {
  if (errors > 0) errors -= 0.1;
}, 100);

function maybeThrow(message: String) {
  errors++;
  if (errors < 5) {
    console.error('Error suppressed:', message);
    return;
  }
  throw message;
}

type DataPoint = { alpha: number; X: number; Y: number; Z: number; VG: number };

async function main() {
  let def = 'None';

  const sigintCleanup = CLI.onSIGINT(() => ForceQuit(400));

  const stopListening = await addAttachListener(serial => {
    console.log('\r', 'Device attached:', chalk.grey(new Date().toLocaleTimeString()), serial);
    def = serial;
    console.log(`Serial Number [${def}]: `);
  });

  start();

  const selectedSerial = (await CLI.prompt('')).trim() || def;

  stopListening();

  const motor = USBInterface(selectedSerial);

  await prepareMotor(motor);

  const scan: { angle: number; low: DataPoint; high: DataPoint }[] = [];

  console.log('Enabling motor');

  // Give the motor time to get to starting position
  await sendCommand(motor, { mode: CommandMode.Calibration, amplitude: maxAmplitude, angle: 0 });
  await delay(100);

  console.log('Motor centered');

  const stepDelay = 3;
  const end = 3 * 256 * 15;

  for (let angle = 0; angle < end; angle++) {
    await sendCommand(motor, { mode: CommandMode.Calibration, amplitude: maxAmplitude, angle });

    await delay(stepDelay);

    const high = await readDataSet(motor);

    await sendCommand(motor, { mode: CommandMode.Calibration, amplitude: 0, angle });

    await delay(stepDelay);

    const low = await readDataSet(motor);

    scan.push({ angle, low, high });

    if (angle % 128 == 0)
      console.log('Step: ', angle, percent(angle / end), 'Temperature:', low.temperature, 'Current:', high.current);
  }

  console.log('Generating outputs');

  const logger = createWriteStream('fields.csv');

  logger.write('angle,low alpha,low x,low y,low z,low VG,high alpha,high x,high y,high z,high VG' + EOL);
  scan.forEach(({ angle, low, high }) =>
    logger.write(
      angle +
        `,${low.alpha},${low.X},${low.Y},${low.Z},${low.VG}` +
        `,${high.alpha},${high.X},${high.Y},${high.Z},${high.VG}` +
        EOL
    )
  );
  logger.end();

  const width = 1000;
  const height = 1000;

  const chartNode = new ChartjsNode(width, height);

  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'low X',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { X }, angle }) => ({ x: angle, y: X })),
          backgroundColor: '#ff0000',
        },
        {
          label: 'low Y',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { Y }, angle }) => ({ x: angle, y: Y })),
          backgroundColor: '#00ff00',
        },
        {
          label: 'low Z',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { Z }, angle }) => ({ x: angle, y: Z })),
          backgroundColor: '#0000ff',
        },
        {
          label: 'low Gain',
          yAxisID: 'VG',
          data: scan.map(({ low: { VG }, angle }) => ({ x: angle, y: VG })),
          backgroundColor: '#000000',
        },
        {
          label: 'low Alpha',
          yAxisID: 'Alpha',
          data: scan.map(({ low: { alpha }, angle }) => ({ x: angle, y: alpha })),
          backgroundColor: '#e541f4',
        },
        {
          label: 'high X',
          yAxisID: 'XYZ',
          data: scan.map(({ high: { X }, angle }) => ({ x: angle, y: X })),
          backgroundColor: '#ff0000',
          pointRadius: 1,
        },
        {
          label: 'high Y',
          yAxisID: 'XYZ',
          data: scan.map(({ high: { Y }, angle }) => ({ x: angle, y: Y })),
          backgroundColor: '#00ff00',
          pointRadius: 1,
        },
        {
          label: 'high Z',
          yAxisID: 'XYZ',
          data: scan.map(({ high: { Z }, angle }) => ({ x: angle, y: Z })),
          backgroundColor: '#0000ff',
          pointRadius: 1,
        },
        {
          label: 'high Gain',
          yAxisID: 'VG',
          data: scan.map(({ high: { VG }, angle }) => ({ x: angle, y: VG })),
          backgroundColor: '#000000',
          pointRadius: 1,
        },
        {
          label: 'high Alpha',
          yAxisID: 'Alpha',
          data: scan.map(({ high: { alpha }, angle }) => ({ x: angle, y: alpha })),
          backgroundColor: '#e541f4',
          pointRadius: 1,
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
              labelString: 'Amplitude',
            },
            type: 'linear',
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
            scaleLabel: { fontSize: 24, display: true, labelString: 'Alpha' },
            type: 'linear',
            position: 'right',
            display: true,
            // ticks: { min: 0, max: 2 ** 14 },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', 'fields.png');

  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'delta X',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { X: low }, high: { X: high }, angle }) => ({ x: angle, y: high - low })),
          backgroundColor: '#ff0000',
        },
        {
          label: 'delta Y',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { Y: low }, high: { Y: high }, angle }) => ({ x: angle, y: high - low })),
          backgroundColor: '#00ff00',
        },
        {
          label: 'delta Z',
          yAxisID: 'XYZ',
          data: scan.map(({ low: { Z: low }, high: { Z: high }, angle }) => ({ x: angle, y: high - low })),
          backgroundColor: '#0000ff',
        },
        {
          label: 'delta Alpha',
          yAxisID: 'Alpha',
          data: scan.map(({ low: { alpha: low }, high: { alpha: high }, angle }) => ({ x: angle, y: high - low })),
          backgroundColor: '#e541f4',
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
              labelString: 'Amplitude',
            },
            type: 'linear',
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
            scaleLabel: { fontSize: 24, display: true, labelString: 'Alpha' },
            type: 'linear',
            position: 'right',
            display: true,
            // ticks: { min: 0, max: 2 ** 14 },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', 'deltas.png');

  chartNode.destroy();

  sigintCleanup();

  console.log('Force quitting?');

  ForceQuit(500);

  // CLI.close();
}

main();
