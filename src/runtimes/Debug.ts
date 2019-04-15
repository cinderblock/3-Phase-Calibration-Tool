'use strict';

import USB, { CommandMode, MLXCommand, Command, ReadData } from 'smooth-control';

import { makePacket, Opcode, Marker } from 'mlx90363';

const serial = 'None';
const usb = USB(serial);

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
  console.log(command);
  return new Promise(res => {
    try {
      usb.write(command, res);
    } catch (e) {
      console.log('not Sent because:', e);
      res();
    }
  });
}

const mode = CommandMode.Calibration;

// Ramp amplitude up slowly
let amplitude = 0;

usb.events.on('status', async (s: string) => {
  if (s != 'ok') return;

  // Motor connected

  console.log('Starting');

  await sendCommand(GetAlpha);
  // Give sensor time to make reading
  await delay(10);
  await sendCommand(GetXYZ);

  const xyzDelay = delay(10);

  // Double read to force reading of newest data
  await usb.read();
  let data: false | ReadData;

  await delay(1);

  while (true) {
    data = await usb.read();
    if (!data) throw 'Data missing?';
    if (!data.mlxParsedResponse) {
      console.log('No parsed response');
      await delay(100);
      return;
      continue;
    } else break;
  }

  if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
    console.log('Error frame. Error:', data.mlxParsedResponse.error);
    await delay(10);
    throw 'Received Error Frame';
  }

  if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
    console.log('NTT');
    await delay(10);
    throw 'Nothing to transmit';
  }

  const { alpha } = data.mlxParsedResponse;
});

// Actually start looking for the usb device
usb.start(false);
