import USBInterface, {
  CommandMode,
  addAttachListener,
  ControllerState,
  ControllerFault,
  start,
  FaultData,
  Command,
  isNormalState,
  ServoCommand,
  PushCommand,
  isServoCommand,
  isServoPositionCommand,
  MultiTurnFromNumber,
} from 'smooth-control';
import readline from 'readline';
import chalk from 'chalk';
import ExponentialFilter from '../utils/ExponentialFilter';
import { clearInterval } from 'timers';
import { ServoMode, isServoAmplitudeCommand, isFaultState, isInitData } from 'smooth-control/dist/parseData';

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
let asymmetry = 0;

let CyclesPerRevolution: number;

console.log('Amplitude:', amplitude);

const calibrated = false;

let lastState: ControllerState;
let lastFault: ControllerFault;

type RunMode = 'sinusoidal' | 'constant' | 'square';

async function main() {
  let runMode: RunMode = 'sinusoidal';
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
        if (isFaultState(data)) lastFault = data.fault;

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

      if (!isFaultState(data) || !isInitData(data)) {
        throw new Error('Invalid initial state!');
      }

      console.log(data);

      if (!data.calibration) {
        console.log('Uncalibrated!');
        usb.close();
        return;
      }

      CyclesPerRevolution = data.cyclesPerRevolution;

      console.log(`Calibrated (v${data.calibration.version}) at:`, data.calibration.time);

      let writes = 0;
      let CRCfails = 0;
      let controlLoops = 0;

      const currentFilter = ExponentialFilter(0.1);
      let current: number;
      const tempFilter = ExponentialFilter(0.1);
      let temperature: number;
      let pos: number;
      let alpha: number;
      let commandAmplitude: number;

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
          'command',
          commandAmplitude,
          'Alpha/4:',
          alpha,
          regularCommand,
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
        if (data.position !== undefined) pos = data.position;
        commandAmplitude = data.amplitude;

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

      const extraCommands: Command[] = [];

      const regularCommand: ServoCommand | PushCommand = { mode, command: 0 };

      let lastSign: 1 | -1 = 1;

      async function sendCommand(): Promise<void> {
        if (busy) return;

        let value = amplitude;

        const t = (Date.now() - zero) / 1000;

        const oscillation = Math.sin(t * 2 * Math.PI * Frequency) - asymmetry;

        if (runMode == 'sinusoidal') value *= oscillation;

        const sign = Math.sign(oscillation) as 1 | -1 | 0;

        if (sign) lastSign = sign;

        if (runMode == 'square') value *= sign || lastSign;

        if (isServoCommand(regularCommand)) {
          if (isServoPositionCommand(regularCommand)) {
            const newCommand = MultiTurnFromNumber(value, CyclesPerRevolution);
            Object.assign(regularCommand, newCommand);
          }
          if (isServoAmplitudeCommand(regularCommand)) {
            regularCommand.command = value;
          }
        } else {
          regularCommand.command = value;
        }

        writes++;

        const override = extraCommands.shift();

        const res = usb.write(override || regularCommand);

        if (!res) {
          if (override) extraCommands.unshift(override);
          return;
        }

        busy = true;

        await res;

        busy = false;
      }

      let interval: NodeJS.Timeout;

      let errors = 0;

      function loop(): void {
        sendCommand().catch(e => {
          if (e.errno === 0) return;

          console.log('Error in loop:');
          console.log(e);
          console.log('writes:', writes);

          if ((errors += 2) > 5) {
            clearInterval(interval);
            process.exitCode = 1;
          }
        });

        if (errors > 0) errors--;
      }

      interval = setInterval(loop, 1000 / 300);

      rl.on('line', input => {
        input = input.trim();
        if (!input) {
          regularCommand.mode = CommandMode.Push;
          amplitude = 0;
        }

        if (input[0] == 'i') {
          clearInterval(interval);
          const div = +input.substring(1);
          if (div) interval = setInterval(loop, 1000 / div);
        }

        if (input[0] == 'o') {
          if (runMode != 'sinusoidal' || !amplitude) {
            zero = Date.now();
          }
          runMode = 'sinusoidal';
          amplitude = +input.substring(1);
        }

        if (input[0] == 'c') {
          runMode = 'constant';
          amplitude = +input.substring(1);
        }

        if (input[0] == 'a') {
          asymmetry = +input.substring(1);
        }

        if (input[0] == 'f') {
          amplitude = 0;
          Frequency = +input.substring(1);
        }

        if (input == 'servo') {
          Object.assign(regularCommand, {
            mode: CommandMode.Servo,
            servoMode: ServoMode.Position,
            kP: 0,
            kI: 0,
            kD: 0,
          });
        }

        if (input == 'push') {
          Object.assign(regularCommand, {
            mode: CommandMode.Servo,
            servoMode: ServoMode.Amplitude,
          });
        }

        if (input == 'square') {
          runMode = 'square';
        }

        if (input.startsWith('kp')) {
          if (isServoCommand(regularCommand) && isServoPositionCommand(regularCommand)) {
            regularCommand.kP = +input.substring(2);
          }
        }
        if (input.startsWith('kd')) {
          if (isServoCommand(regularCommand) && isServoPositionCommand(regularCommand)) {
            regularCommand.kD = +input.substring(2);
          }
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
