import { UserControlsFull } from './UserControls';

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
   * Control constants
   */
  userControls: UserControlsFull;
};
