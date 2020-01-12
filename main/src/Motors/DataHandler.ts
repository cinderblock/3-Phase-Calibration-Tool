import { state } from '../State';
import MotorHandler, { Motor } from './CommHandler';

/* Turn off this file for now

import { mapMotors, MotorsData } from '../renderer-shared-types/utils/MotorLayout';

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

//*/
