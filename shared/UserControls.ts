import { RunMode } from './MotorData';
import { MotorsData } from './utils/MotorLayout';
import { PIDConstants } from './utils/PIDTypes';
import { RecursivePartial } from './utils/RecursivePartial';


export type UserControls = {
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
