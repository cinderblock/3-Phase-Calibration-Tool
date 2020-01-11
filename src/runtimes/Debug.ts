'use strict';

import Motor, { CommandMode, MLXCommand, Command, ReadData } from 'smooth-control';

import { makePacket, Opcode, Marker } from 'mlx90363';

const serial = 'None';
const motor = Motor(serial);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function sendCommand(command: Command) {
  console.log('Command sent:', command);
  return new Promise(res => {
    try {
      motor.write(command, res);
    } catch (e) {
      console.log('not Sent because:', e);
      res();
    }
  });
}

const mode = CommandMode.Calibration;

// Ramp amplitude up slowly
let amplitude = 0;

motor.onStatus(async s => {
  if (s != 'connected') return;

  // Motor connected

  console.log('Starting');

  await sendCommand(GetAlpha);
  // Give sensor time to make reading
  await delay(10);
  await sendCommand(GetXYZ);

  const xyzDelay = delay(10);

  // Double read to force reading of newest data
  const first = await motor.read();

  console.log('First read:', first);

  let data: false | ReadData;

  await delay(1);

  while (true) {
    data = await motor.read();
    if (!data) throw new Error('Data missing?');
    if (!data.mlxParsedResponse) {
      console.log(`No parsed response: [${data.mlxParsedResponse}]`);
      await delay(100);
      return;
      continue;
    } else break;
  }

  if (typeof data.mlxParsedResponse == 'string') {
    console.log('Error decoding: ' + data.mlxParsedResponse);
    return;
  }

  if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
    console.log('Error frame. Error:', data.mlxParsedResponse.error);
    await delay(10);
    throw new Error('Received Error Frame');
  }

  if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
    console.log('NTT');
    await delay(10);
    throw new Error('Nothing to transmit');
  }

  const { alpha } = data.mlxParsedResponse;
});

// Actually start looking for the usb device
motor.start();
