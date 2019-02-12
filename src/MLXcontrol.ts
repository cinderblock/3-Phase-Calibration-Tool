import USBInterface, {
  MLXCommand,
  ReadData,
  addAttachListener,
  CommandMode,
} from './USBInterface';
import readline from 'readline';
import chalk from 'chalk';

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

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
  await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
  });

  const serial = (await prompt('Serial Number [None]: ')).trim() || 'None';
  const usb = USBInterface(serial);

  usb.events.on('status', async (s: string) => {
    if (s != 'ok') return;

    // Motor connected

    console.log('Starting');

    const mode = CommandMode.MLXDebug;
    const data = Buffer.allocUnsafe(7);

    const command: MLXCommand = { mode, data };

    const MAPXYZ = 0x102a;

    const addr = MAPXYZ;

    // Read same location twice for now...
    data.writeUInt16LE(addr, 0);
    data.writeUInt16LE(addr, 2);
    data[6] = 0b11000010;

    let result: ReadData;

    while (true) {
      await new Promise(res => usb.write(command, res));
      await delay(1000);
      const data = await usb.read();

      if (!data) {
        console.log('Response missing?');
        await delay(100);
        continue;
      }

      if (!data.localMLXCRC) {
        console.log('CRC Invalid on device?');
        await delay(100);
        continue;
      }

      result = data;

      break;
    }

    await prompt('EEWrite?');

    usb.write(command);
  });

  // Actually start looking for the usb device without automatic polling
  usb.start(false);
}

main();
