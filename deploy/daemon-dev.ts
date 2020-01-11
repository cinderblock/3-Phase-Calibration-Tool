#!/usr/bin/env node

if (module.parent) throw new Error('Incorrect usage');

import * as log from './utils/debug';
import watchBuildTransferRun from './src/watchBuildTransferRun';
import { sshSpawn } from './src/sshRun';
import { Folder as ConfigFolderHandler } from './src/ConfigurationsHandler';
import { remoteDataPrinter } from './src/remoteDataPrinter';

type Options = {
  clean: boolean | 'full';
  config: string;
};

const args = process.argv.slice(2);

// Defaults
const opts: Options = {
  clean: true,
  config: 'config',
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--nuke':
    case '--full-clean':
      opts.clean = 'full';
      break;
    case '--no-clean':
      opts.clean = false;
      break;
    default:
      opts.config = args[i];
      break;
  }
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

let journal: ThenArg<ReturnType<typeof sshSpawn>>;

watchBuildTransferRun({
  connect: {
    host: 'some.host',
    username: 'pi',
  },

  async onConnect(ssh) {
    if (opts.clean) {
      const save = opts.clean !== 'full';

      const modules = 'deploy/daemon/node_modules';
      const temp = 'temp_node_modules';

      // Save node_modules optionally
      if (save) await ssh.exec('mv', [modules, temp]);

      // Clean
      await ssh.exec('rm', ['-rf', 'deploy']);

      // Restore saved
      if (save) {
        await ssh.exec('mkdir', ['-p', 'deploy/daemon']);
        await ssh.exec('mv', [temp, modules]);
      }
    }

    await ssh.exec('mkdir', ['-p', 'deploy/dataFiles']);
  },

  postCompile(data) {
    // ConfigFolderHandler(data, { remoteModuleDir: 'deploy/daemon', selectedConfig: 'config' });
  },

  remote: {
    directory: 'deploy',

    stop: (ssh): ReturnType<typeof sshSpawn> => sshSpawn(log, ssh, ['sudo', 'systemctl', 'stop', 'deploy']),

    start: async (ssh): ReturnType<typeof sshSpawn> => {
      // Start journal once
      if (!journal) {
        journal = await sshSpawn(log, ssh, ['journalctl', '-fu', 'deploy', '-n0']);
        journal.stdin.on('data', remoteDataPrinter(log, 'journalctl', 'stdout'));
        journal.stderr.on('data', remoteDataPrinter(log, 'journalctl', 'stderr'));
        journal.on('close', () => {
          // Let journal restart if it dies for some reason
          journal = undefined;
        });
      }

      return sshSpawn(log, ssh, ['sudo', 'systemctl', 'start', 'deploy']);
    },
  },

  log,
}).catch(e => log.error(e.toString()));
