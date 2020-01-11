import chalk from 'chalk';
import USB, {
  CommandMode,
  addAttachListener,
  start as startUSB,
  PushCommand,
  ServoCommand,
  ReadData,
} from 'smooth-control';
import { MotorState, ProcessedMotorData } from '../../shared/MotorData';
import { PIDs } from '../../shared/utils/PIDTypes';
import { PowerAccumulationApproximator } from './PowerAccumulationApproximator';
import { makeCountConverter } from './CountConverter';

// Sometimes we get bad data for some reason.
// Just throw it all away if reported velocity is greater than this:
const maxVelocity = 5000; // What should this be?
const maxAcceleration = 1000; // 100 keeps throwing error

export type MotorStateUpdate = Partial<MotorState>;

// Print to console whenever any motor is attached
addAttachListener(id => console.log('Motor detected:', id));

// Start looking for smooth control devices
startUSB();

export const motorCountsPerRevolution = 3 * 256 * 15;

export interface Motor {
  motorCountsPerRevolution: number;
  stop: () => void;
  enable: () => void;
  disable: () => void;
  clearFault: () => void;
  setConstant: (constant: PIDs, value: number) => void;
  goToPosition: (pos: number) => false | Promise<void>;
  push: (amplitude: number) => void;
  close: () => void;
}

export default function initializeMotor(
  serial: string,
  zero: number,
  forward: boolean,
  sharedState: MotorState,
  onAttach: () => void,
): Motor {
  // Initialize statues
  sharedState.connected = false;
  sharedState.enabled = true;
  sharedState.command = {};

  const motor = USB(serial, { debug: false });

  const direction = forward ? 1 : -1;

  const temperatureThreshold = 380;

  const powerThreshold = 20000000;
  const powerResistance = 0.9;
  const powerIntegrator = PowerAccumulationApproximator(powerResistance);
  const { countsToPosition, positionToCounts } = makeCountConverter(motorCountsPerRevolution, zero);

  let active = false;
  let enabled = false;

  const vRef = 2.56; // volts
  const maxADC = 1023; // Counts

  let skipped = 0;

  const pushCommand: PushCommand = { mode: CommandMode.Push, command: 0 };

  function push(command: number): false | Promise<void> {
    if (!enabled) return false;

    if (active && command) {
      skipped++;
      return false;
    }
    // active = true;

    command *= direction;

    pushCommand.command = command;

    const wrote = motor.write(pushCommand);

    if (wrote) {
      return wrote.then(() => {
        active = false;
        if (!sharedState.command) return;
        sharedState.command.mode = 'constant';
        sharedState.command.command = command;
      });
    }

    active = false;
    return false;
  }

  function stop(): false | Promise<void> {
    return push(0);
  }

  function enable(): void {
    enabled = true;
  }

  function disable(): false | Promise<void> {
    const ret = stop();
    enabled = false;
    active = false;
    return ret;
  }

  motor.onData(data => {
    // console.log(newData);
    // Extract the data we want from newData
    const { velocity, amplitude, cpuTemp, vBatt, VDD, current } = data;

    // TODO: glitch rejection
    if (Math.abs(velocity) > maxVelocity) return;

    const accumulatedEnergy = powerIntegrator(amplitude);

    if ((cpuTemp > temperatureThreshold || accumulatedEnergy > powerThreshold) && enabled) {
      stop();
      console.log('Emergency shutdown. Over' + (cpuTemp > temperatureThreshold ? 'temp' : 'accumulation'));
      enabled = false;
    }

    const position = countsToPosition(data.position) * direction;

    // ADC counts follow this equation
    // count = Vin * rBot/(rTop + rBot) * maxADC/vRef
    // To get voltage, we invert and bring in constants from the PCB design
    // Vin = counts * (1 + rTop/rBot) * vRef/maxADC

    const mainVoltage = (vBatt * (1 + 100 / 10) * vRef) / maxADC;
    const gateDriveVoltage = (VDD * (1 + 140 / 100) * vRef) / maxADC;

    // Current sense has extra amplifiers:
    // counts = I * rSense * Gain * maxADC / vRef
    // I = counts * vRef / maxADC / Gain / rSense

    const amps = (current * vRef) / (maxADC * 20 * 0.05);

    if (!sharedState.data) sharedState.data = {} as ReadData;
    // TODO: Is this efficient?
    Object.assign(sharedState.data, data);

    if (!sharedState.processed) sharedState.processed = {} as ProcessedMotorData;
    sharedState.processed.accumulatedEnergy = accumulatedEnergy;
    sharedState.processed.position = position;
    sharedState.processed.batteryVoltage = mainVoltage;
    sharedState.processed.gateVoltage = gateDriveVoltage;
    sharedState.processed.totalCurrent = amps;
  });

  motor.onError(console.log.bind(0, chalk.red(`Motor ${serial} error:`)));

  motor.onStatus(status => {
    console.log('status:', serial, status);
    const connected = status == 'connected';

    sharedState.connected = connected;

    if (connected) onAttach();
  });

  function clearFault(): false | Promise<void> {
    return motor.write({ mode: CommandMode.ClearFault }) as false | Promise<void>;
  }

  const servoConstantCommand: ServoCommand = { mode: CommandMode.Servo, command: 0, pwmMode: 'kP' };

  function setConstant(constant: PIDs, value: number): false | Promise<void> {
    if (!enabled) return false;

    const ret = motor.write(servoConstantCommand) as false | Promise<void>;

    if (ret) {
      ret.then(() => {
        if (!sharedState.command) return;
        sharedState.command[constant] = value;
      });
    }

    return ret;
  }

  const servoCommand: ServoCommand = { mode: CommandMode.Servo, pwmMode: 'position', command: 0 };

  /**
   * Command the internal servo of motor to go to specific position
   *
   * @param pos 0 - middle, 1 top of travel, 0 bottom.
   */
  function goToPosition(pos: number): false | Promise<void> {
    if (!enabled) return false;

    if (active) {
      skipped++;
      return false;
    }
    // active = true;

    pos *= direction;

    servoCommand.command = positionToCounts(pos);

    const wrote = motor.write(servoCommand);

    if (wrote) {
      return wrote.then(() => {
        active = false;
        if (!sharedState.command) return;
        sharedState.command.command = servoCommand.command;
        sharedState.command.mode = 'position';
      });
    }

    active = false;
    return false;
  }

  setInterval(() => {
    if (!skipped) return;
    console.log(serial, 'skipped', skipped, 'commands');
    skipped = 0;
  }, 1000);

  return {
    motorCountsPerRevolution,
    stop,
    enable,
    disable,
    clearFault,
    setConstant,
    goToPosition,
    push,
    close: (): void => motor.close(),
  };
}
