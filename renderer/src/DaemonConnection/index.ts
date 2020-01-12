import { State } from '../shared/State';

import { ipcRenderer } from 'electron';

// Make state available in console
ipcRenderer.on('update', (event, state: State) => Object.assign(window, { state }));

ipcRenderer.on('error', console.log.bind(0, 'Error:'));

export default ipcRenderer;
