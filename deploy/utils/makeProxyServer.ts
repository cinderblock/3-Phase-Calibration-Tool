import httpProxy from 'http-proxy';
import { hostname } from 'os';

type Options = {
  remoteHost: string;
  remotePort: number;
  localPort?: number;
};

export function makeProxyServer({ remoteHost, remotePort, localPort = remotePort }: Options): httpProxy {
  return httpProxy
    .createProxyServer({
      target: `http://${remoteHost}:${remotePort}`,
      ws: true,
      headers: {
        'x-forwarded-for': hostname(),
      },
    })
    .listen(localPort)
    .on('error', e => {
      // console.log('http proxy error:', e);
    });
}
