import { join } from 'path';
import { promises as fs } from 'fs';
import { ConnectOptions } from '../src/ssh2.types';

export async function automaticPrivateKey(opts: ConnectOptions): Promise<void> {
  if (opts.agent || opts.privateKey || opts.password) return;

  if (process.env.SSH_AUTH_SOCK) opts.agent = process.env.SSH_AUTH_SOCK;
  else if (process.platform === 'win32') opts.agent = 'pageant';
  else {
    // No agent detected
  }

  if (process.env.HOME && !opts.agent) {
    const keyFiles = ['id_rsa', 'id_dsa', 'id_ecdsa'];
    for (const i in keyFiles) {
      try {
        const file = join(process.env.HOME, '.ssh', keyFiles[i]);
        opts.privateKey = await fs.readFile(file);
        console.log('Found and loaded private key file:', file);
        break;
      } catch (e) {}
    }
    if (!opts.privateKey) {
      // No private key found!
    }
  }
}
