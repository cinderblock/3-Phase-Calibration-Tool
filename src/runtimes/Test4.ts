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

let amplitude: number = +process.argv[2] || 10;

console.log('Amplitude:', amplitude);

type RunMode = 'oscillate';

const motors = {
  left: {
    head: USBInterface('bc447d10-9307-11e9-95b0-716f2038e6f4'),
    // feet: USBInterface(''),
  },
  right: {
    head: USBInterface('4afe9a20-9468-11e9-bec3-7795a92687b2'),
    feet: USBInterface('502ecca0-88a0-11e9-a492-0d9505cf13c6'),
  },
};

function promiseReady(usb: typeof motors.left.head) {
  return new Promise<void>((resolve, reject) => {
    const stopOnStatusListener = usb.onStatus(async (s: string) => {
      if (s != 'connected') return;
      stopOnStatusListener();

      // Read data once and get current motor state/fault
      const [state, fault] = await new Promise<[ControllerState, ControllerFault]>(resolve => {
        const once = usb.onData(data => {
          once();
          resolve([data.state, data.fault]);
        });
      });

      // Test initial state/fault

      if (state !== ControllerState.Fault) {
        console.log('Unexpected initial state:', ControllerState[state]);
        console.log('Continuing...');
      } else if (fault !== ControllerFault.Init) {
        console.log('Unexpected initial fault:', ControllerFault[fault]);

        await new Promise<void>(resolve => {
          const stopWatching = usb.onData(data => {
            if (data.state === ControllerState.Fault && data.fault === ControllerFault.Init) {
              stopWatching();
              resolve();
            }
          });

          usb.write({ mode: CommandMode.ClearFault });

          console.log('Clearing fault. Waiting for fault to be cleared.');
        });
      } else {
        // Good to go!
        console.log('Starting normally.');
      }

      // Ensure motors are calibrated
      const calibrated = await new Promise<boolean>(resolve => {
        const once = usb.onData(data => {
          once();
          resolve(data.calibrated);
        });
      });

      if (!calibrated) {
        console.log('Uncalibrated!');
        reject();
        return;
      }

      resolve();
    });
  });
}

async function main() {
  let runMode: RunMode = 'oscillate';

  start();

  let frequency = 0.5;

  await Promise.all([
    promiseReady(motors.left.head),
    // promiseReady(motors.left.feet),
    promiseReady(motors.right.head),
    promiseReady(motors.right.feet),
  ]);

  // let writes = 0;
  // let CRCfails = 0;
  // let controlLoops = 0;

  // const currentFilter = ExponentialFilter(0.1);
  // let current: number;
  // const tempFilter = ExponentialFilter(0.1);
  // let temperature: number;
  // let pos: number;
  // let alpha: number;

  // const WPS = setInterval(() => {
  //   console.log(
  //     'WPS:',
  //     writes,
  //     'CRCfails:',
  //     CRCfails,
  //     'controlLoops:',
  //     controlLoops,
  //     'Current:',
  //     current.toFixed(2),
  //     'Temperature:',
  //     temperature.toFixed(1),
  //     'Position:',
  //     pos,
  //     'Alpha/4:',
  //     alpha
  //   );
  //   writes = 0;
  //   CRCfails = 0;
  //   controlLoops = 0;
  //   current = 0;
  //   temperature = 0;
  // }, 1000);

  // const dataHandlerStop = usb.onData(data => {
  //   if (data.state !== lastState) {
  //     lastState = data.state;

  //     if (data.state === ControllerState.Fault) {
  //       fault = data.fault;
  //       console.log('New State:', ControllerState[data.state], ' - ', ControllerFault[data.fault], data.fault);
  //     } else {
  //       console.log('New State:', ControllerState[data.state]);
  //     }
  //   } else if (data.state == ControllerState.Fault && data.fault !== fault) {
  //     console.log('New Fault:', ControllerFault[data.fault]);
  //   }

  //   CRCfails += data.mlxCRCFailures;
  //   controlLoops += data.controlLoops;
  //   current = currentFilter(data.current);
  //   temperature = tempFilter(data.cpuTemp);
  //   pos = data.position;
  //   if (data.mlxParsedResponse && typeof data.mlxParsedResponse != 'string') {
  //     if (data.mlxParsedResponse.alpha !== undefined)
  //       alpha = Math.round(((data.mlxParsedResponse && data.mlxParsedResponse.alpha) || 0) / 4);
  //   }

  //   // console.log({ calibrated, ...data });
  // });

  // Motor connected

  console.log('Starting');

  let zero = Date.now();

  rl.on('line', input => {
    input = input.trim();
    if (!input) amplitude = 0;

    if (input[0] == 'o') {
      if (!amplitude) {
        zero = Date.now();
      }

      amplitude = +input.substring(1);
    }

    if (input[0] == 'f') {
      amplitude = 0;
      frequency = +input.substring(1);
    }
  });

  const i = setInterval(async () => {
    const command = amplitude * Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * frequency);

    motors.left.head.write({ mode, command });
    // motors.left.feet.write({ mode, command });
    motors.right.head.write({ mode, command: -command });
    motors.right.feet.write({ mode, command: -command });
  }, 1000 / 300);

  function die() {
    console.log('Dying');
    // Shutdown running write loop
    // clearInterval(WPS);
    clearInterval(i);
    // dataHandlerStop();
    // Stop the motor
    motors.left.head.write({ mode, command: 0 }, motors.left.head.close);
    // motors.left.feet.write({ mode, command: 0 }, motors.left.feet.close);
    motors.right.head.write({ mode, command: 0 }, motors.right.head.close);
    motors.right.feet.write({ mode, command: 0 }, motors.right.feet.close);

    // Just in case, really exit after a short delay.
    setTimeout(() => {
      console.log('Forcing quit');
      process.exit();
    }, 400).unref();
  }

  console.log('on sigint');

  rl.on('SIGINT', die);
}

main();
