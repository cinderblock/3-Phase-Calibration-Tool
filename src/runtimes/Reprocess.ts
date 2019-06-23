'use strict';

import { join } from 'path';
import { promises as fs } from 'fs';

import DataOutputs from '../processes/DataOutputs';
import * as CLI from '../utils/CLI';
import loadDataFromCSV from '../loaders/DataFile';
import ForceQuit from '../utils/ForceQuit';

const cyclesPerRev = 15;

async function getFolderName() {
  while (true) {
    const rawDataFilename = (await CLI.prompt('Data folder? ')).trim();

    if (rawDataFilename) return rawDataFilename;
  }
}

async function main() {
  const sigIntCleanup = CLI.onSIGINT(() => ForceQuit(400));

  const workDir = await getFolderName();

  const generatedFilesDir = join(workDir, 'generated');

  // Make directory and don't error if it exists
  await fs.mkdir(generatedFilesDir).catch(e => {});

  const serial = 'Test';

  sigIntCleanup();

  const regex = /(?<name>H(?<H>\d+)R(?<R>[0-9.]{5})(?<N>-\d)?)\.csv/;

  for (const filename of await fs.readdir(workDir)) {
    const match = regex.exec(filename);

    if (!match) continue;

    const { name, H, R, N } = match.groups as { name: string; H: string; R: string; N: string };

    // Make directory and don't error if it exists
    await fs.mkdir(join(generatedFilesDir, name)).catch(e => {});

    // Do not try to run many of these in parallel. You will run out of memory.
    await DataOutputs(serial, loadDataFromCSV(join(workDir, filename)), cyclesPerRev, [generatedFilesDir, name]);
  }

  console.log('done');
  // CLI.close();

  ForceQuit(500);
}

main();
