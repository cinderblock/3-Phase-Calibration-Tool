import USBInterface, {
  CommandMode,
  addAttachListener,
  ReadData,
  ControllerState,
  ControllerFault,
} from 'smooth-control';
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

const amplitude: number = +process.argv[2] || 40;

console.log('Amplitude:', amplitude);

let calibrated = false;

let lastState: ControllerState;
let lastFault: ControllerFault;

async function main() {
  let def = 'None';

  const stopAttachListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  stopAttachListening();

  const usb = USBInterface(serial);
  const Frequency = 0.5;

  const dataListener = async (s: string) => {
    if (s != 'ok') return;

    usb.events.removeListener('status', dataListener);

    await new Promise<void>((resolve, reject) => {
      usb.events.once('data', (data: ReadData) => {
        lastState = data.state;
        lastFault = data.fault;
        resolve();
      });
    });

    // Test initial state
    if (lastState !== ControllerState.Fault) {
      console.log('Unexpected initial state:', ControllerState[lastState]);
      console.log('Continuing...');
    } else if (lastFault !== ControllerFault.Init) {
      console.log('Unexpected initial fault:', ControllerFault[lastFault]);

      await new Promise<void>((resolvePromise, reject) => {
        const resolve = () => {
          usb.events.removeListener('data', l);
          resolvePromise();
        };

        const l = (data: ReadData) => {
          console.log(data.current);
          lastState = data.state;
          lastFault = data.fault;
          if (
            data.state === ControllerState.Fault &&
            data.fault === ControllerFault.Init
          )
            resolve();
        };

        usb.events.on('data', l);

        usb.write({ mode: CommandMode.ClearFault });

        console.log('Clearing fault. Waiting for fault to be cleared.');
      });
    } else {
      // Good to go!
      console.log('Starting normally!');
    }

    // await new Promise<void>((resolve, reject) => {
    //   usb.events.on('data', (data: ReadData) => {
    //     lastState = data.state;
    //     lastFault = data.fault;
    //     resolve();
    //   });
    // });

    usb.events.once('data', (data: ReadData) => {
      if (!data.calibrated) {
        console.log('Uncalibrated!');
        usb.close();
        return;
      }
      console.log('Calibrated!');

      usb.events.on('data', (data: ReadData) => {
        if (data.state !== lastState) {
          lastState = data.state;

          if (data.state === ControllerState.Fault) {
            lastFault = data.fault;
            console.log(
              'New State:',
              ControllerState[data.state],
              ' - ',
              ControllerFault[data.fault],
              data.fault
            );
          } else {
            console.log('New State:', ControllerState[data.state]);
          }
        } else if (
          data.state == ControllerState.Fault &&
          data.fault !== lastFault
        ) {
          console.log('New Fault:', ControllerFault[data.fault]);
        }

        // console.log({ calibrated, ...data });
      });

      // Motor connected

      console.log('Starting');

      let writes = 0;

      const WPS = setInterval(() => {
        console.log('WPS:', writes);
        writes = 0;
      }, 1000);

      const zero = Date.now();

      const i = setInterval(async () => {
        const command =
          amplitude *
          Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * Frequency);

        usb.write({ mode, command });
        writes++;
      }, 1000 / 300);

      function die() {
        // Shutdown running write loop
        clearInterval(i);
        // Stop the motor
        usb.write({ mode, command: 0 }, usb.close);
        // Close USB connection
        usb.close();

        // Just in case, really exit after a short delay.
        setTimeout(process.exit, 400).unref();
      }

      process.on('SIGINT', die);
    });
  };

  usb.events.on('status', dataListener);

  // Actually start looking for the usb device
  usb.start();
}

main();
