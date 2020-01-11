import { createServer } from 'http';
import { uptime } from 'os';
import chalk from 'chalk';
import SocketIO from 'socket.io';
import ServerStarter = require('server-starter');
import { State } from '../shared/State';
import { UserControlUpdate } from '../shared/UserControls';

let clientID = 0;

export type UserControlsHandler = (userControls: UserControlUpdate) => void;
export type TeardownHandler = () => void;

export type StateUpdater = (state: State) => void;

const controlListeners: UserControlsHandler[] = [];

export function makeClientHandler(): {
  onControlUpdate: (handler: UserControlsHandler) => TeardownHandler;
  close: () => void;
  update: StateUpdater;
} {
  // Helper function that is run every time a new webUI connects to us
  function setupClientSocket(sock: SocketIO.Socket): void {
    const ID = clientID++;

    // TODO: Do we trust the proxy to set true `x-real-ip` header?
    const headers = sock.conn.request.headers;
    const address = headers['x-forwarded-for'] || headers['x-real-ip'] || sock.handshake.address;
    console.log(chalk.green('Client connected:'), chalk.cyan(address));

    // Give clients a our startup time once
    sock.emit('startupTime', Date.now() - uptime() * 1000);

    // Don't listen to client events for a sec on startup.
    // Ignores events that were "sent" after server shutdown (and are therefore still pending)
    setTimeout(() => {
      sock.on('userControls', (userControls: UserControlUpdate) => {
        // Received user controls
        controlListeners.forEach(handler => handler(userControls));
      });
    }, 500);
  }

  const server = createServer();

  const sock = SocketIO(server, {
    serveClient: false,
    transports: ['websocket'],
    pingInterval: 1000,
  });

  // When a new client connects, setup handlers for the possible incoming commands
  sock.on('connection', setupClientSocket);

  ServerStarter(
    server,
    {
      listen: 8000,
      // listen: '/tmp/daemon.sock',
      // socketMode: 0o777,
      // socketOwner: {
      //   //user: 'pi',
      //   group: 'www-data',
      // },
    },
    (err, info, extra) => {
      if (err) {
        console.log(chalk.red('ERROR:'), err, info, extra);
      } else {
        // console.log('Listening:', info);
      }
    },
  );

  function onControlUpdate(handler: UserControlsHandler): TeardownHandler {
    controlListeners.push(handler);

    // Return a cleanup function
    return (): void => {
      const i = controlListeners.indexOf(handler);
      if (i < 0) return;
      controlListeners.splice(i, 1);
    };
  }

  return {
    onControlUpdate,
    close: (): void => sock.close(),
    update: (state): void => {
      sock.volatile.emit('update', state);
    },
  };
}
