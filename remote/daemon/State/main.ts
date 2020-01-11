import { protectedControls } from './UserControls';

import { State } from '../../shared/State';

// State of the system with initial values
export const state: State = {
  time: Date.now(),


  userControls: protectedControls,
};
export default state;
