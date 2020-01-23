import { RecursivePartial } from './utils/RecursivePartial';

export enum UserCommands {
  ClearFault,
  ReadMLX,
}

export type ClearFaultCommand = {
  command: UserCommands.ClearFault;
};

export type ReadMlxCommand = {
  command: UserCommands.ReadMLX;
  which: 'xyz' | 'nop';
  period?: number;
};

export enum RunMode {
  /**
   * Motor disconnected. Initial condition.
   */
  Disconnected,
  /**
   * Manually send each command to the motor
   */
  Manual,
  /**
   * Regularly send commands to the motor. Prevents timeouts
   */
  Automatic,
  /**
   * Running an automated calibration sequence
   */
  Calibration,
}

export enum MotorCommandMode {
  /**
   * Set coils to a fixed motor phase
   */
  PhasePosition,

  /**
   * Use motor's internal synchronous drive mode
   */
  Synchronous,

  /**
   * Constant "push" (Approximates torque. Falls off with speed)
   */
  Push,

  /**
   * Motor Internal Servo Mode
   */
  Servo,
}

export type UserCommand = ClearFaultCommand | ReadMlxCommand;

export type UserControls = {
  /**
   * Serial number of the device we're connecting to
   */
  connected?: string;

  /**
   * Mode that this program is running in
   */
  mode: RunMode;

  /**
   * Time to wait between MLX readings
   * @unit milliseconds
   */
  mlxCommandInterval: number;

  drive: {
    /**
     * Time to wait between Motor commands
     * @unit milliseconds
     */
    CommandInterval: number;

    /**
     * In RunMode.Automatic, how should we tell the motor to behave?
     */
    CommandMode: MotorCommandMode;

    /**
     * Desired drive angle for test
     * @unit radian
     */
    angle?: number;

    /**
     * Desired drive amplitude for test
     * @unit [0, 255]
     */
    amplitude?: number;

    /**
     * Desired drive amplitude for test
     * @unit [-255, 255]
     */
    velocity?: number;
  };
};

export type UserControlsAutomatic = {
  /**
   * To help detect when user controls have changed. Maybe won't be used.
   */
  sequence: number;
};

export type UserControllable = RecursivePartial<UserControls>;

export type UserControlsFull = UserControls & UserControlsAutomatic;

export type UserControlUpdate = UserControllable & UserControlsAutomatic;
