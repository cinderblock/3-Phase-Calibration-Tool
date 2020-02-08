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
import 'source-map-support/register';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const motors: (undefined | ReturnType<typeof USBInterface>)[] = [];
let balance = 0;

/**
 * Add a motor to the active list, but ensure it is added in a "balanced" way
 * since we use the index to pick each motor's direction and keep the hardware "balanced".
 * @param usb Motor usb port to add to the list of running motors
 */
function addMotor(usb: ReturnType<typeof USBInterface>): number {
  console.log('balance', balance, motors.length);
  let res = motors.findIndex((m, index) => {
    console.log('checking index', index, !!m);

    if (m) return false;

    if (balance === 0) return true;

    console.log('searching...');

    return (index % 2 === 0) === balance > 0;
  });

  console.log('res', res);

  if (res < 0) {
    res = motors.push(usb) - 1;
    console.log('pushed', res);
  } else {
    console.log('overwrite', res);

    motors[res] = usb;
  }

  const delta = (2 * (res % 2) - 1) as -1 | 1;

  balance += delta;

  // eslint-disable-next-line prefer-const
  let removeMotor: () => void;

  const onceDisconnect = usb.onStatus(s => {
    if (s !== 'missing') return;
    removeMotor();
  });

  const onceError = usb.onError(e => {
    console.log('Motor error...');
    console.log(e);
    removeMotor();
  });

  removeMotor = (): void => {
    console.log('Cleaning up...');
    motors[res] = undefined;
    usb.close();
    onceDisconnect();
    onceError();
    balance -= delta;
  };

  console.log(`Added motor at position ${res}. Balance is ${balance}.`);
  console.log(motors.map(m => !!m));

  return res;
}

function prompt(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    rl.question(prompt, s => {
      rl.removeListener('SIGINT', reject);
      resolve(s);
    });
    rl.once('SIGINT', reject);
  });
}

const mode = CommandMode.Push;

let amplitude: number = process.argv[2] ? +process.argv[2] : 10;

let intervalDivider = 300;

console.log('Amplitude:', amplitude);

type RunMode = 'oscillate' | 'constant';

function waitForConnected(usb: ReturnType<typeof USBInterface>): Promise<void> {
  return new Promise(resolve => {
    const stopOnStatusListener = usb.onStatus(status => {
      if (status != 'connected') return;
      stopOnStatusListener();
      resolve();
    });
  });
}

function waitForInit(usb: ReturnType<typeof USBInterface>): Promise<void> {
  return new Promise(resolve => {
    const cleanup = usb.onData(data => {
      if (data.state !== ControllerState.Fault) return;
      if (data.fault !== ControllerFault.Init) return;
      cleanup();
      resolve();
    });
  });
}

function readDataOnce(usb: ReturnType<typeof USBInterface>): Promise<ReadData> {
  return new Promise(resolve => {
    const cleanup = usb.onData(data => {
      cleanup();
      resolve(data);
    });
  });
}

function readStateAndFaultOnce(
  usb: ReturnType<typeof USBInterface>,
): Promise<
  { state: ControllerState.Fault; fault: ControllerFault } | { state: ControllerState.Manual | ControllerState.Normal }
> {
  // Read data once and get current motor state/fault
  return new Promise(resolve => {
    const cleanup = usb.onData(data => {
      cleanup();
      resolve(data.state !== ControllerState.Fault ? { state: data.state } : { state: data.state, fault: data.fault });
    });
  });
}

async function initializeMotor(usb: ReturnType<typeof USBInterface>): Promise<void> {
  await waitForConnected(usb);

  // Read data once and get current motor state/fault
  const init = await readStateAndFaultOnce(usb);

  // Test initial state/fault

  if (init.state !== ControllerState.Fault) {
    console.log('Unexpected initial state:', ControllerState[init.state]);
    console.log('Continuing...');
  } else if (init.fault !== ControllerFault.Init) {
    console.log('Unexpected initial fault:', ControllerFault[init.fault]);

    const start = waitForInit(usb);

    usb.write({ mode: CommandMode.ClearFault });
    console.log('Clearing fault. Waiting for fault to be cleared.');

    await start;
  } else {
    // Good to go!
    console.log('Starting normally.');
  }

  //// Ensure motors are calibrated
  // const data = await readDataOnce(usb);
  // if (!calibrated) {
  //   console.log('Uncalibrated!');
  //   reject();
  //   return;
  // }

  addMotor(usb);
  const once = usb.onError(e => {
    once();
    console.log('onError!!!');
    console.log(e);
  });
}

async function main(): Promise<void> {
  let runMode: RunMode = 'oscillate';

  start();

  const cleanupAttach = addAttachListener(serial => {
    console.log('Attaching to', serial);
    initializeMotor(USBInterface(serial, { debug: true }));
  });

  let frequency = 0.5;

  let writes = 0;
  let CRCfails = 0;
  let controlLoops = 0;

  // const currentFilter = ExponentialFilter(0.1);
  // let current: number;
  // const tempFilter = ExponentialFilter(0.1);
  // let temperature: number;
  // let pos: number;
  // let alpha: number;

  const WPS = setInterval(() => {
    console.log(
      'WPS:',
      writes,
      'CRCfails:',
      CRCfails,
      'controlLoops:',
      controlLoops,
      // 'Current:',
      // current.toFixed(2),
      // 'Temperature:',
      // temperature.toFixed(1),
      // 'Position:',
      // pos,
      // 'Alpha/4:',
      // alpha
    );
    writes = 0;
    CRCfails = 0;
    controlLoops = 0;
    // current = 0;
    // temperature = 0;
  }, 1000);

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
      frequency = +input.substring(1);
    }

    if (input[0] == 'i') {
      intervalDivider = +input.substring(1);
      restartInterval();
    }
  });

  const busy: boolean[] = [];

  async function loop() {
    let command = amplitude;

    if (runMode == 'oscillate') command *= Math.sin(((Date.now() - zero) / 1000) * 2 * Math.PI * frequency);

    motors.forEach(async (m, index) => {
      if (!m) return;
      if (busy[index]) return;

      const res = m.write({ mode, command: index % 2 ? command : -command });

      if (!res) {
        // motor disconnected?
        return;
      }

      busy[index] = true;

      try {
        await res;
        writes++;
      } catch (e) {
        console.log('Write Error!!!!', e);
      }

      busy[index] = false;
    });
  }

  let interval = setInterval(loop, 1000 / intervalDivider);

  function restartInterval() {
    clearInterval(interval);
    if (intervalDivider) interval = setInterval(loop, 1000 / intervalDivider);
  }

  async function die() {
    // Just in case, really exit after a short delay.
    setTimeout(() => {
      console.log('Forcing quit');
      process.exit();
    }, 500).unref();

    console.log('Dying');
    // Shutdown running write loop
    // clearInterval(WPS);
    clearInterval(interval);

    cleanupAttach();

    await Promise.all(
      motors.map(async m => {
        if (!m) return;
        const res = m.write({ mode, command: 0 });

        if (!res) {
          // disconnected?
          return;
        }

        await res;
        m.close();
      }),
    );
  }

  rl.on('SIGINT', die);
}

main();
