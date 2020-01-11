import { Sources } from './Sources';

type Options = { remoteModuleDir: string; selectedConfig: string };

export function Folder(data: Sources, { remoteModuleDir, selectedConfig }: Options): void {
  const configFilePath = remoteModuleDir + '/configs/config.js';

  // Remove the map for the one we're adding
  const configFileMap = data.findIndex(({ filename }) => filename == configFilePath.replace(/\.js$/, '.map.js'));
  if (configFileMap >= 0) data.splice(configFileMap, 1);

  // Find the local one in the list, if possible
  let configFile = data.find(({ filename }) => filename == configFilePath);
  if (!configFile) {
    configFile = {
      filename: configFilePath,
      source: '', // Temp empty string
    };
    data.push(configFile);
  }

  configFile.source = `'use strict';\nexports.__esModule=true;exports.default=require('./${selectedConfig}').default;\n`;
}

/**
 * Replace a single config.js with the sources from config.remote.js
 *
 * @param data Sources to modify
 * @param param1 options
 */
export function RemoteFile(data: Sources, { remoteModuleDir }: { remoteModuleDir: string }): void {
  // Special handling for the config file
  const remoteConfig = data.find(({ filename }) => filename == remoteModuleDir + '/config.remote.js');
  const localConfig = data.findIndex(({ filename }) => filename == remoteModuleDir + '/config.js');
  if (remoteConfig) {
    if (localConfig > -1) {
      data.splice(localConfig, 1);
    }
    remoteConfig.filename = remoteModuleDir + '/config.js';
  }
}
