import { protectedControls } from './UserControls';

import { State } from '../renderer-shared-types/State';

// State of the system with initial values
export const state: State = {
  time: Date.now(),

  motorState: { writeErrors: 0 },

  connectedMotorSerials: [],

  userControls: protectedControls,
};

export { protectedControls };

export { realControls } from './UserControls';

export { updateTimes } from './Time';
