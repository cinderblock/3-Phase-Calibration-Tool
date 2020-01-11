import { state } from '../State/main';
import { Gpio } from '../utils/pigpio';
import config from '../Config';
import MotorHandler, { Motor } from './CommHandler';
import { mapMotors, MotorsData } from '../../shared/utils/MotorLayout';

const Resets = mapMotors({ traction: 0, steering: 0 }, pin => new Gpio(pin, { mode: Gpio.OUTPUT }));

let motors: MotorsData<Motor>;

export function getMotors(): MotorsData<Motor> {
  if (!motors) {
    motors = mapMotors(config.motors, ({ serial, zero }: { serial: string; zero?: number }, which) =>
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      MotorHandler(serial, zero ?? 0, true, state.motors[which], motorOnAttach(which)),
    );
  }

  let motorsReadyResolver: () => void;
  const motorsReady = new Promise<void>(resolve => (motorsReadyResolver = resolve));

  return motors;
}

function motorOnAttach(which: 'traction' | 'steering') {
  return async (): Promise<void> => {
    console.log('Motor Attached!', which);
    const m = getMotors()[which];
    m.clearFault();
    m.enable();
    // m.push(0);
    // Motor attached!
    // TODO: send current PID constants
    // TODO: stop any previous command. Clear faults
  };
}
