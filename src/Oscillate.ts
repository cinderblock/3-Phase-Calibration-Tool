import USBInterface, { CommandMode, addAttachListener } from './USBInterface';
import readline from 'readline';
import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    rl.question(prompt, resolve);
  });
}

const mode = CommandMode.Push;

const amplitude = 40;

let calibrated = false;

async function main() {
  let def = 'None';

  await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  const usb = USBInterface(serial);

  usb.events.on(
    'data',
    (data: {
      status: string;
      fault: string;
      rawAngle: number;
      calibrated: boolean;
    }) => {
      if (!calibrated && data.calibrated) {
        calibrated = true;
        console.log('Calibrated!');
      }

      // console.log({ calibrated, ...data });
    }
  );

  const Frequency = 0.5;

  usb.events.on('status', (s: string) => {
    if (s != 'ok') return;

    // Motor connected

    console.log('Starting');

    const zero = Date.now();

    const i = setInterval(async () => {
      const command =
        amplitude *
        Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * Frequency);

      usb.write({ mode, command });
    }, 1000 / 60);
  });

  // Actually start looking for the usb device
  usb.start();
}

main();
