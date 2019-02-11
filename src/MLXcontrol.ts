import USBInterface from './USBInterface';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    rl.question(prompt, resolve);
  });
}

let calibrated = false;

async function main() {
  const serial = await prompt('Serial Number [None]: ');
  const usb = USBInterface(serial);

  usb.events.on('data', data => {
    if (!calibrated && data.calibrated) {
      calibrated = true;
      console.log('Calibrated!');
    }

    console.log(data);
  });

  usb.events.on('status', (s: string) => {
    if (s != 'ok') return;

    // Motor connected

    console.log('Starting');
  });

  // Actually start looking for the usb device
  usb.start();
}

main();
