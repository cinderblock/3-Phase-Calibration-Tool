import { State } from '../main-shared-types/State';

import { ipcRenderer as backend } from 'electron';

// Make state available in console
backend.on('StateUpdate', (event, state: State) => {
  Object.assign(window, { state });
  console.log('newState:', state);
});

backend.on('error', console.log.bind(0, 'Error:'));

export default backend;
