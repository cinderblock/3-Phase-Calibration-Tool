import { readdirSync, statSync } from 'fs';

/**
 * Scan a directory deeply to find all files.
 *
 * @notice Does not handle symlink loops
 *
 * @param dir Directory to search
 * @param fileList List of files to append to
 */
export function walkSync(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  fileList = fileList || [];

  files.forEach(function(file) {
    if (statSync(dir + file).isDirectory()) {
      fileList = walkSync(dir + file + '/', fileList);
    } else {
      const fileName = dir + file;
      fileList.push(fileName);
    }
  });

  return fileList;
}
