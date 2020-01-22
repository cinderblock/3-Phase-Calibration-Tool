import USBInterface, {
  CommandMode,
  addAttachListener,
  ReadData,
  ControllerState,
  ControllerFault,
  start,
  FaultData,
  NormalData,
  isNormalState,
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

let amplitude: number = process.argv[2] ? +process.argv[2] : 30;

console.log('Amplitude:', amplitude);

const calibrated = false;

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
        lastFault = (data as FaultData).fault;
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
          lastFault = (data as FaultData).fault;
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

      // if (!(data as NormalData).calibrated) {
      //   console.log('UncalibratUncalibrated!');
      //   usb.close();
      //   return;
      // }
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
          alpha,
        );
        writes = 0;
        CRCfails = 0;
        controlLoops = 0;
        current = 0;
        temperature = 0;
      }, 1000);

      let errs = 0;

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

        if (!isNormalState(data)) {
          if (errs++ > 10) throw new Error('bad state!' + data.state);
          return;
        }

        CRCfails += data.mlxCRCFailures;
        controlLoops += data.controlLoops;
        current = currentFilter(data.current);
        temperature = tempFilter(data.cpuTemp);
        pos = data.position;
        // if (data.mlxParsedResponse && typeof data.mlxParsedResponse != 'string') {
        //   if (data.mlxParsedResponse.alpha !== undefined)
        //     alpha = Math.round(((data.mlxParsedResponse && data.mlxParsedResponse.alpha) || 0) / 4);
        // }

        // console.log({ calibrated, ...data });
      });

      // Motor connected

      console.log('Starting');

      let zero = Date.now();

      let busy = false;

      async function loop() {
        let command = amplitude;

        if (runMode == 'oscillate') command *= Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * Frequency);

        if (!busy) {
          writes++;
          const res = usb.write({ mode, command });

          if (res) {
            busy = true;
            res.then(() => (busy = false));
          }
        }
      }

      let interval = setInterval(loop, 1000 / 300);

      rl.on('line', input => {
        input = input.trim();
        if (!input) amplitude = 0;

        if (input[0] == 'i') {
          clearInterval(interval);
          const div = +input.substring(1);
          if (div) interval = setInterval(loop, 1000 / div);
        }

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

      async function die() {
        console.log('Dying');
        // Shutdown running write loop
        clearInterval(WPS);
        clearInterval(interval);
        dataHandlerStop();
        // Stop the motor
        const res = usb.write({ mode, command: 0 });

        if (res) await res;

        usb.close();

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
