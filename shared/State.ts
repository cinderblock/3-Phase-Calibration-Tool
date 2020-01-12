import { UserControlsFull } from './UserControls';
import { MotorState } from './MotorData';

/**
 * The shape of state is defined here.
 * State
 */
export type State = {
  /**
   * System time
   *
   * @units milliseconds
   */
  time: number;

  /**
   * Program uptime
   *
   * @units seconds
   */
  uptime?: number;

  /**
   * System time delta from last run
   *
   * @units seconds
   */
  dt?: number;

  /**
   * List of serial numbers currently connected
   */
  connectedMotorSerials: string[];

  /**
   * The state of the active motor
   */
  motorState: MotorState;

  /**
   * Control constants
   */
  userControls: UserControlsFull;
};
