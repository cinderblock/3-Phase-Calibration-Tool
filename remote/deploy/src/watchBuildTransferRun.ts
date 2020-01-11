import SSH2Promise = require('ssh2-promise');
import ts from 'typescript';
import { Observable, combineLatest, merge } from 'rxjs';
import { debounceTime, map, filter, mergeMap } from 'rxjs/operators';

import observeFileChange from '../utils/observeFile';
import { ConnectOptions } from './ssh2.types';
import * as debug from '../utils/debug';
import { isPathString, isDirectoryString } from '../utils/pathTypeDiscriminators';
import { reduceFileListToMinimalDirs } from '../utils/reduceFileListToMinimalDirs';
import { getCompiledSourcesFromProgram } from './getCompiledSourcesFromProgram';
import { mkdir } from '../utils/mkdir';
import { remoteExecYarn } from './remoteExecYarn';
import { automaticPrivateKey } from '../utils/automaticPrivateKey';
import { makeProxyServer } from '../utils/makeProxyServer';
import { Sources } from './Sources';

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

export type Debug = typeof debug;

export type Options = {
  /**
   * Connect options passed to ssh
   *
   * @note The multiple hop ssh scheme requires `nc` to be available
   */
  connect: ConnectOptions;

  /**
   * Some function to run on the sources before they are sent to remote
   */
  postCompile?: (data: Sources) => void;

  /**
   * Get access to ssh connection after it starts
   */
  onConnect?: (ssh: SSH2Promise) => Promise<void>;

  /**
   * Options related to settings on the remote system
   */
  remote: {
    /**
     * Directory on remote that we put everything into
     */
    directory: string;

    /**
     * Function to call to stop running services before deploying
     */
    stop?: (ssh: SSH2Promise) => Promise<void>;
    /**
     * Function to call to start running services after deploying
     */
    start?: (ssh: SSH2Promise) => Promise<void>;
  };

  /**
   * Options for local system
   */
  local?: {
    /**
     * Root of project to sync to remote
     */
    basePath?: string;
    /**
     * Dir inside basePath that is built and synced to remote
     */
    moduleDir?: string;
  };

  /**
   * List of files not compiled by typescript to move over manually
   *
   * `package.json` and `yarn.lock` will automatically be included.
   */
  manualSyncFiles?: string[];

  /**
   * Where to log status to
   */
  log?: Debug;

  exitAfterDeploy?: boolean;
};

export default async function watchBuildTransferRun(options: Options): Promise<void> {
  if (options.local?.basePath !== undefined && !isPathString(options.local.basePath))
    throw new Error('Invalid path specified for options.local.basePath');
  const basePath = options.local?.basePath ?? '../';

  if (options.local?.moduleDir !== undefined && !isDirectoryString(options.local.moduleDir))
    throw new Error('Invalid module directory specified for options.local.moduleDir');
  const moduleDir = options.local?.moduleDir ?? 'daemon';

  if (options.remote.directory === undefined || !isDirectoryString(options.remote.directory))
    throw new Error('Invalid remote directory specifier string');
  const remotePath = options.remote.directory ? `${options.remote.directory}/` : '';

  const localModuleDir = basePath + moduleDir;
  const remoteModuleDir = remotePath + moduleDir;

  const remoteStop = options.remote.stop || ((): Promise<void> => new Promise(resolve => resolve()));
  const remoteStart = options.remote.start || ((): Promise<void> => new Promise(resolve => resolve()));

  if (!options.connect.host) throw new Error('Must specify remote host');

  const configPath = ts.findConfigFile(localModuleDir, ts.sys.fileExists) as string;
  if (!configPath) throw new Error('Could not find a valid tsconfig.json.');

  await automaticPrivateKey(options.connect);

  options.connect.reconnectDelay = options.connect.reconnectDelay ?? 250;

  options.connect.compress = true;

  options.connect.agentForward = true;

  // options.connect.debug = (...msg) => options.log?.info('SSH DEBUG:', ...msg);

  options.log?.info('Connecting ...', options.connect);

  const ssh = new SSH2Promise(options.connect);

  await ssh.connect().catch((e: Error) => {
    options.log?.error(e?.name, e);
    throw new Error('Connection failed');
  });

  await options.onConnect?.(ssh);

  const sftp = ssh.sftp();

  await mkdir(ssh, remoteModuleDir);

  const manualSyncFiles = options.manualSyncFiles || [];

  // Always sync package.json and yarn.lock
  manualSyncFiles.push('package.json', 'yarn.lock');

  async function updatePackagesAndManualTransfers(): Promise<void> {
    options.log?.info('📦 Synchronizing files');

    const dirs = reduceFileListToMinimalDirs(manualSyncFiles)
      // Prepend remote directory
      .map(d => [remoteModuleDir, d].join('/'));

    if (dirs.length) await mkdir(ssh, dirs);

    await Promise.all(
      manualSyncFiles.map(f =>
        sftp.fastPut(localModuleDir + '/' + f, remoteModuleDir + '/' + f).catch((e: Error) => {
          options.log?.error(e && e.name, 'Failed to put', f, localModuleDir, remoteModuleDir, e);
        }),
      ),
    );

    options.log?.info('📦 Updating module dependencies');

    await remoteExecYarn(ssh, remoteModuleDir, options.log);

    options.log?.info('📦 Dependencies up to date');
  }

  /**
   * Read the program, process it if necessary, and write to remote.
   * @param program TypeScript Compiler Program
   */
  async function handleCompiledSources(program: ts.EmitAndSemanticDiagnosticsBuilderProgram): Promise<void> {
    const data = getCompiledSourcesFromProgram(program);

    options.postCompile?.(data);

    // Get a minimized list of the directories needed to be made
    const dirs = reduceFileListToMinimalDirs(data.map(({ filename }) => filename));

    if (dirs.length) await mkdir(ssh, dirs);

    // Write all the compiled output from TypeScript Compiler to remote
    await Promise.all(data.map(({ filename, source }) => sftp.writeFile(filename, source, {})));
  }

  /**
   * Single shot build.
   *
   * WIP
   */
  async function compileAndDistributeSources(): Promise<void> {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) throw config.error;

    ts.createProgram([basePath + moduleDir], config.config);

    // TODO: finish

    // handleCompiledSources(program)
  }

  // WIP new "main"
  if (options.exitAfterDeploy && false) {
    options.remote.start?.(ssh);

    const deploy: Promise<void>[] = [];
    deploy.push(updatePackagesAndManualTransfers());
    deploy.push(compileAndDistributeSources());
    await Promise.all(deploy);

    options.remote.stop?.(ssh);

    return;
  }

  // Create a proxy so that the ui running locally can talk to the daemon as if it were also running locally
  makeProxyServer({ remoteHost: options.connect.host, remotePort: 8000 });
  // ssh.addTunnel is easier but breaks easier. So, we use the above instead.
  // ssh.addTunnel({ localPort: 8000, remoteAddr: 'localhost', remotePort: 8000 });

  let buildingCount = 0;

  function markBuilding(): void {
    buildingCount++;
  }

  function doneBuilding(): void {
    buildingCount--;
  }

  const packageUpdates = merge(...manualSyncFiles.map(f => observeFileChange(localModuleDir + '/' + f)))
    // Writes to these files come in bursts. We only need to react after the burst is done.
    .pipe(debounceTime(200))
    // Mark that we're building and shouldn't start a run
    .pipe(map(markBuilding))
    .pipe(mergeMap(() => remoteStop(ssh)))
    // Copy the files and run yarn over ssh. Don't re-run until that is complete.
    .pipe(mergeMap(updatePackagesAndManualTransfers))
    .pipe(map(doneBuilding))
    .pipe(map(() => options.log?.green('✔ Packages updated')));

  const buildAndPush = new Observable<void>(observable => {
    const host = ts.createWatchCompilerHost(
      configPath,

      { outDir: remotePath, rootDir: basePath },

      ts.sys,

      ts.createEmitAndSemanticDiagnosticsBuilderProgram,

      (diagnostic: ts.Diagnostic): void =>
        options.log?.error(
          'Error',
          diagnostic.code,
          ':',
          ts.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine()),
        ),
      // options.log?.error(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost));

      (diagnostic: ts.Diagnostic): void =>
        options.log?.info('TypeScript:', ts.formatDiagnostic(diagnostic, formatHost).trimRight()),
    );

    const origCreateProgram = host.createProgram;
    host.createProgram = (rootNames, opts, host, oldProgram): ts.EmitAndSemanticDiagnosticsBuilderProgram => {
      options.log?.cyan('🔨 Starting new compilation');
      markBuilding();
      remoteStop(ssh);
      return origCreateProgram(rootNames, opts, host, oldProgram);
    };

    host.afterProgramCreate = async (program): Promise<void> => {
      options.log?.magenta('🔨 Finished compilations');

      await handleCompiledSources(program);

      observable.next();

      // TODO: Check if there is something that this was doing that we needed.
      // origPostProgramCreate(program);
    };

    ts.createWatchProgram(host);

    return (): void => {
      ts.createEmitAndSemanticDiagnosticsBuilderProgram;
    };
  })
    .pipe(map(doneBuilding))
    .pipe(map(() => options.log?.green('✔ Sources updated')));

  combineLatest(packageUpdates, buildAndPush)
    // .pipe(map(() => options.log?.info('Build count:', buildingCount)))
    .pipe(filter(() => buildingCount == 0))
    .subscribe(
      async () => {
        await remoteStart(ssh);

        if (options.exitAfterDeploy) process.exit();
      },
      e => {
        options.log?.error('Error in Observable:', e.toString());
        ssh.close();
      },
    );
}

// TODO: Connect debugger/source maps to running node instance

// TODO: Handle user input. forward to remote. What about exit signal?
