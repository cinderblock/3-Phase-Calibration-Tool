import SSH2Promise from 'ssh2-promise';
import { ExecOptions } from 'ssh2';
import * as debug from '../utils/debug';

export async function sshSpawn(
  log: typeof debug,
  ssh: SSH2Promise,
  args: string[],
  options: ExecOptions = {},
): ReturnType<SSH2Promise['spawn']> {
  const cmd = args.shift();

  if (!cmd) throw new Error('Must specify a command to run');

  const spawn = await ssh.spawn(cmd, args, options);

  spawn.allowHalfOpen = false;

  // Remove verboseness from ssh.spawn
  spawn.removeAllListeners('finish');
  spawn.removeAllListeners('close');

  spawn.on('error', log.variable);

  return spawn;
}
