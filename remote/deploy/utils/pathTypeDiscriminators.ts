export function isDirectoryString(dir: string): boolean {
  if (dir === '') return false;
  if (dir.substr(-1) == '/') return false;
  return true;
}

export function isPathString(dir: string): boolean {
  // return !isDirectoryString(dir);
  if (dir === '') return true;
  if (dir.substr(-1) == '/') return true;
  return false;
}
