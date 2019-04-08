'use strict';

import USB, { addAttachListener, CommandMode, Command } from 'smooth-control';
import readline from 'readline';
import chalk from 'chalk';

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

  let def = 'N/A';

  const stopListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
    console.log(`Serial Number [${def}]: `);
  });

  // TODO: wait until first connected device is detected

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  stopListening();

  rl.close();

  const usb = USB(serial);

  usb.start();

  usb.events.on('status', async status => {
    if (status != 'ok') {
      console.log('Not ok');
      return;
    }

    await new Promise<void>(resolve => usb.write(({ mode: CommandMode.Bootloader } as unknown) as Command, resolve));

    usb.close();

    setTimeout(() => {
      console.log('Force killing');
      process.kill(0);
    }, 500).unref();
  });
}

main();
