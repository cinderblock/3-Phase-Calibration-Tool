import { State } from '../shared/State';

import { ipcRenderer as backend } from 'electron';

// Make state available in console
backend.on('update', (event, state: State) => Object.assign(window, { state }));

backend.on('error', console.log.bind(0, 'Error:'));

export default backend;
