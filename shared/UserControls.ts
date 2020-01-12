import { RecursivePartial } from './utils/RecursivePartial';

export type TestCommand = 'debugMLX' | 'clearFault' | 'manual';

export type UserControls = {
  /**
   * Serial number of the device we're connecting to
   */
  connected?: string | undefined;

  /**
   * Mode we're testing the motor in
   */
  testCommand?: TestCommand | undefined;

  /**
   * Desired drive angle for test
   * @unit radian
   */
  angle?: number | undefined;

  /**
   * Desired drive amplitude for test
   * @unit 0-255
   */
  amplitude?: number | undefined;
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
