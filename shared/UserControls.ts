import { RecursivePartial } from './utils/RecursivePartial';

export type UserControls = {
  /**
   * Serial number of the device we're connecting to
   */
  connected?: string | undefined;
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
