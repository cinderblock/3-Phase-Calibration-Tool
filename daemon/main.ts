import * as debug from './utils/debug';
import { makeClientHandler } from './ClientHandler';
import { handleIncomingControls, realControls as userControls } from './UserControls';
import { State } from '../shared/State';

debug.green('Hello, world.');

// Events from the clients and how to handle them
const remoteControlServer = makeClientHandler();

remoteControlServer.onControlUpdate(handleIncomingControls);

const state: State = {
  debug: {
    heapUsed: 0,
    gc: {
      count: 0,
    },
  },
  time: Date.now(),
  userControls,
};

setInterval(() => {
  remoteControlServer.update(state);
}, 1000 / 30);

function Shutdown(): void {
  setImmediate(() => {
    // Shutdown remote control server
    remoteControlServer.close();

    // Just kill the process in a short time in case we've forgotten to stop something...
    setTimeout(() => {
      debug.error('Something is still running...', 'Forcing a shutdown.');
      process.exit(0);
    }, 100).unref();
  });
}
