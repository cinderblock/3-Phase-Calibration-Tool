export function reduceFileListToMinimalDirs(fileList: string[]): string[] {
  return (
    fileList
      // Strip filenames
      .map(filename => filename.replace(/(\/|^)[^/]*$/, ''))
      // non-empty and Unique
      .filter((value, i, arr) => value && arr.indexOf(value) === i)
      // Filter to only needed `mkdir`s, keep if we don't find any others that would make the current dir
      .filter((value, i, arr) => !arr.find((other, j) => i !== j && other.startsWith(value)))
  );
}
