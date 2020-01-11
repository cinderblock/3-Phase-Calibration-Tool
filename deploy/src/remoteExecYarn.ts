import SSH2Promise = require('ssh2-promise');
import { ClientChannel, ExecOptions } from 'ssh2';
import { remoteDataPrinter } from './remoteDataPrinter';
import { Debug } from './watchBuildTransferRun';

export async function remoteExecYarn(ssh: SSH2Promise, cwd: string, log?: Debug): Promise<void> {
  const execOptions: ExecOptions = {};

  const args: string[] = [];

  // Run all yarn commands in module directory
  args.push('--cwd', cwd);

  args.push('install');
  // Don't install dev dependencies
  args.push('--production');
  // Don't prompt for anything
  args.push('--non-interactive');
  // Help with yarn running concurrently
  args.push('--network-concurrency', '1');
  args.push('--mutex', 'network');
  // Output streaming from yarn is not yet supported
  args.push('--no-progress');

  try {
    const yarn: ClientChannel = await ssh.spawn('yarn', args, execOptions);
    yarn.allowHalfOpen = false;

    // Remove verboseness from ssh.spawn
    yarn.removeAllListeners('finish');
    yarn.removeAllListeners('close');

    if (log) {
      yarn.on('data', remoteDataPrinter(log, 'yarn', 'stdout'));
      yarn.stderr.on('data', remoteDataPrinter(log, 'yarn', 'stderr'));
    }

    return new Promise(resolve => yarn.on('end', resolve));
  } catch (e) {
    log?.error('Error running remote yarn', e);
  }
}
