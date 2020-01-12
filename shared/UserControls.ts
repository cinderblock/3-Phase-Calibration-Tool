import { RecursivePartial } from './utils/RecursivePartial';

export type TestCommand = 'debugMLX' | 'clearFault';

export type UserControls = {
  /**
   * Serial number of the device we're connecting to
   */
  connected?: string | undefined;

  /**
   * Mode we're testing the motor in
   */
  testCommand?: TestCommand;
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
