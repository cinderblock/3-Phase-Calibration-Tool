import SSH2Promise = require('ssh2-promise');
import { ExecOptions } from 'ssh2';

/**
 * Helper function to create directories on our connected host.
 * @param dir Directory (or array of) to create on connected remote
 */
export async function mkdir(ssh: SSH2Promise, dir: string | string[]): ReturnType<SSH2Promise['exec']> {
  const execOptions: ExecOptions = {};

  if (!dir.length) throw new Error('Invalid mkdir list');

  return ssh.exec('mkdir', ['-p', ...(typeof dir === 'string' ? [dir] : dir)], execOptions);
}
