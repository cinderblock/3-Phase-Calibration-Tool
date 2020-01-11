import { UserControlsFull } from './UserControls';

/**
 * The shape of state is defined here.
 * State
 */
export type State = {
  debug: {
    heapUsed: number;
    gc: {
      count: number;
      duration?: number;
      type?: 'Scavenge' | 'MarkSweepCompact';
    };
  };

  /**
   * System time, milliseconds.
   *
   * Do not use for dt calculations. Is mangled regularly.
   */
  time: number;

  /**
   * Control constants
   */
  userControls: UserControlsFull;
};
