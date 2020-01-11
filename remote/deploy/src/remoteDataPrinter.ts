import chalk from 'chalk';
import { Debug } from './watchBuildTransferRun';
/**
 * Helper function to print formatted output with useful colors
 * @param process First string to print
 * @param stream Regular or Error
 */
export function remoteDataPrinter(dest: Debug, process: string, stream: 'stderr' | 'stdout'): (data: Buffer) => void {
  const log = dest.makeVariableLog({
    colors: [chalk.grey, stream == 'stderr' ? chalk.magenta : chalk.yellow],
    modulo: 0,
  });
  return (data: Buffer): void => {
    // options.log?.info('incoming data:', data);
    data
      .toString()
      .trimRight()
      .split('\n')
      .map(line => log(process, stream, line.trimRight()));
    // options.log?.info('Finished block');
  };
}
