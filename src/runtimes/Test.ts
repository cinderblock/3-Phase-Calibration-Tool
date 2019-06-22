import USBInterface, {
  CommandMode,
  addAttachListener,
  ReadData,
  ControllerState,
  ControllerFault,
  start,
} from 'smooth-control';
import readline from 'readline';
import chalk from 'chalk';
import ExponentialFilter from '../utils/ExponentialFilter';

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

let amplitude: number = +process.argv[2] || 40;

console.log('Amplitude:', amplitude);

let calibrated = false;

let lastState: ControllerState;
let lastFault: ControllerFault;

type RunMode = 'oscillate' | 'constant';

async function main() {
  let runMode: RunMode = 'oscillate';
  let def = 'None';

  const stopAttachListening = await addAttachListener(id => {
    console.log('\r', chalk.grey(new Date().toLocaleTimeString()), id);
    def = id;
  });

  start();

  const serial = (await prompt(`Serial Number [${def}]: `)).trim() || def;

  stopAttachListening();

  const usb = USBInterface(serial);
  let Frequency = 0.5;

  const stopOnStatusListener = usb.onStatus(async (s: string) => {
    if (s != 'connected') return;

    stopOnStatusListener();

    // Read data once and get current motor state/fault
    await new Promise<void>((resolve, reject) => {
      const once = usb.onData(data => {
        lastState = data.state;
        lastFault = data.fault;
        once();
        resolve();
      });
    });

    // Test initial state
    if (lastState !== ControllerState.Fault) {
      console.log('Unexpected initial state:', ControllerState[lastState]);
      console.log('Continuing...');
    } else if (lastFault !== ControllerFault.Init) {
      console.log('Unexpected initial fault:', ControllerFault[lastFault]);

      await new Promise<void>((resolve, reject) => {
        const once = usb.onData(data => {
          console.log(data.current);
          lastState = data.state;
          lastFault = data.fault;
          if (data.state === ControllerState.Fault && data.fault === ControllerFault.Init) {
            once();
            resolve();
          }
        });

        usb.write({ mode: CommandMode.ClearFault });

        console.log('Clearing fault. Waiting for fault to be cleared.');
      });
    } else {
      // Good to go!
      console.log('Starting normally!');
    }

    // await new Promise<void>((resolve, reject) => {
    //   usb.on('data', (data: ReadData) => {
    //     lastState = data.state;
    //     lastFault = data.fault;
    //     resolve();
    //   });
    // });

    const once = usb.onData(data => {
      once();

      if (!data.calibrated) {
        console.log('Uncalibrated!');
        usb.close();
        return;
      }
      console.log('Calibrated!');

      let writes = 0;
      let CRCfails = 0;
      let controlLoops = 0;

      const currentFilter = ExponentialFilter(0.1);
      let current: number;
      const tempFilter = ExponentialFilter(0.1);
      let temperature: number;
      let pos: number;
      let alpha: number;

      const WPS = setInterval(() => {
        console.log(
          'WPS:',
          writes,
          'CRCfails:',
          CRCfails,
          'controlLoops:',
          controlLoops,
          'Current:',
          current.toFixed(2),
          'Temperature:',
          temperature.toFixed(1),
          'Position:',
          pos,
          'Alpha/4:',
          alpha
        );
        writes = 0;
        CRCfails = 0;
        controlLoops = 0;
        current = 0;
        temperature = 0;
      }, 1000);

      const dataHandlerStop = usb.onData(data => {
        if (data.state !== lastState) {
          lastState = data.state;

          if (data.state === ControllerState.Fault) {
            lastFault = data.fault;
            console.log('New State:', ControllerState[data.state], ' - ', ControllerFault[data.fault], data.fault);
          } else {
            console.log('New State:', ControllerState[data.state]);
          }
        } else if (data.state == ControllerState.Fault && data.fault !== lastFault) {
          console.log('New Fault:', ControllerFault[data.fault]);
        }

        CRCfails += data.mlxCRCFailures;
        controlLoops += data.controlLoops;
        current = currentFilter(data.current);
        temperature = tempFilter(data.cpuTemp);
        pos = data.position;
        if (data.mlxParsedResponse && typeof data.mlxParsedResponse != 'string') {
          if (data.mlxParsedResponse.alpha !== undefined)
            alpha = Math.round(((data.mlxParsedResponse && data.mlxParsedResponse.alpha) || 0) / 4);
        }

        // console.log({ calibrated, ...data });
      });

      // Motor connected

      console.log('Starting');

      let zero = Date.now();

      rl.on('line', input => {
        input = input.trim();
        if (!input) amplitude = 0;

        if (input[0] == 'o') {
          if (runMode != 'oscillate' || !amplitude) {
            zero = Date.now();
          }
          runMode = 'oscillate';
          amplitude = +input.substring(1);
        }

        if (input[0] == 'c') {
          runMode = 'constant';
          amplitude = +input.substring(1);
        }

        if (input[0] == 'f') {
          amplitude = 0;
          Frequency = +input.substring(1);
        }
      });

      const i = setInterval(async () => {
        const command =
          runMode == 'oscillate'
            ? amplitude * Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * Frequency)
            : amplitude;

        usb.write({ mode, command });
        writes++;
      }, 1000 / 300);

      function die() {
        console.log('Dying');
        // Shutdown running write loop
        clearInterval(WPS);
        clearInterval(i);
        dataHandlerStop();
        // Stop the motor
        usb.write({ mode, command: 0 }, usb.close);

        // Just in case, really exit after a short delay.
        setTimeout(() => {
          console.log('Forcing quit');
          process.exit();
        }, 400).unref();
      }

      console.log('on sigint');

      rl.on('SIGINT', die);
    });
  });
}

main();
