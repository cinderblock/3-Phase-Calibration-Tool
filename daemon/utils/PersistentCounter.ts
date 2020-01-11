import { readFileSync, writeFileSync } from 'fs';

/**
 * Create a counter that will keep counting through restart cycles of the daemon by storing the number on the filesystem
 *
 * @param filename Filename to store persistent number in
 */
export default function getNewNumberFromFile(filename: string): number {
  let newNumber = parseInt(readFileSync(filename, { encoding: 'utf8', flag: 'a+' }), 10);

  if (isNaN(newNumber)) newNumber = 0;
  else newNumber++;

  writeFileSync(filename, newNumber);

  return newNumber;
}
