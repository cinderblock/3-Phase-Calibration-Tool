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

export type UserCommand = ClearFaultCommand | ReadMlxCommand;

export type UserControls = {
  /**
   * Serial number of the device we're connecting to
   */
  connected?: string;

  /**
   * Desired drive angle for test
   * @unit radian
   */
  angle?: number;

  /**
   * Desired drive amplitude for test
   * @unit 0-255
   */
  amplitude?: number;
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
