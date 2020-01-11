import { createServer, Socket, Server } from 'net';

type Options = {
  remoteHost: string;
  remotePort: number;
  localPort?: number;
};

export function makeProxyServer({ remoteHost, remotePort, localPort = remotePort }: Options): Server {
  // TODO: Capture so that we can close gracefully
  return createServer(user => {
    const client = new Socket();

    client.connect(remotePort, remoteHost);

    // 2-way pipe
    user.pipe(client).pipe(user);

    // Catch non-fatal errors
    client.on('error', (): void => {});
    user.on('error', (): void => {});

    // TODO: Should we destroy on close?
    // client.on('close', user.destroy);
    // user.on('close', client.destroy);
  }).listen(localPort);
}
