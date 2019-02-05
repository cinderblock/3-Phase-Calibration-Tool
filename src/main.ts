import USB from './USBInterface';

import ExponentialFilter from './ExponentialFilter';

const usb = USB('None');

let val: number;

const filter = ExponentialFilter(0.1);

usb.events.on('data', data => {
  val = filter(data.rawAngle);
});

const cycle = 3 * 256;
const cyclePerRev = 15;
const Revs = 4;
const End = cycle * cyclePerRev * Revs;

let step = -cycle;

function posMod(x: number) {
  return ((x % cycle) + cycle) % cycle;
}

let dir = 1;
let amplitude = 0;
const maxAmplitude = 60;

usb.events.on('status', s => {
  if (s != 'ok') return;

  console.log('Starting');

  const i = setInterval(async () => {
    if (step >= 0 && step < End) {
      console.log(step, val, dir);
    }

    if (dir > 0 && step > End + cycle) {
      dir = -dir;
    }

    if (dir < 0 && step <= 0) {
      clearInterval(i);

      usb.write({ mode: 'Calibration', amplitude: 0, angle: 0 }, () => {
        usb.close();
      });
      return;
    }

    step += dir;
    if (amplitude < maxAmplitude) amplitude++;
    usb.write({ mode: 'Calibration', amplitude, angle: posMod(step) });
  }, 5);
});

usb.start();
