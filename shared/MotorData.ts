// Sharing from this package to UI is only ok if it is *just* `type`s
import { ReadData } from 'smooth-control';

import { PIDConstants } from './utils/PIDTypes';

export type MotorStatus = 'missing' | 'connected';

export type RunMode = 'constant' | 'position' | 'velocity' | 'current' | 'calibrate' | 'program';

export type MotorCommand = {
  command?: number;
  mode?: RunMode;
} & Partial<PIDConstants>;

export type ProcessedMotorData = {
  /**
   * Current position
   *  - 0 is neutral.
   *  - +1 is top of travel.
   *  - -1 is bottom of travel.
   */
  position: number;
  /**
   * Local estimate of heat equation for motor
   */
  accumulatedEnergy: number;

  /**
   * Battery voltage in real units
   */
  batteryVoltage: number;

  /**
   * Gate voltage in real units
   */
  gateVoltage: number;

  /**
   * Total current in real units
   */
  totalCurrent: number;
};

export type MotorState = {
  /**
   * Local disable of specific motor. Maybe for safety. Maybe for testing.
   */
  enabled?: boolean;
  /**
   * If this motor is currently connected to the MotorHandler
   */
  connected?: boolean;
  /**
   * Cache of last commands sent to motor
   */
  command?: MotorCommand;
  /**
   * Most recent raw data from motor
   */
  data?: ReadData;
  /**
   * Most recent processed data from motor
   */
  processed?: ProcessedMotorData;

  dropped?: boolean;

  powered?: boolean;

  writeErrors: number;
};
