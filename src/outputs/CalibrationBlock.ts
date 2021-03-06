import { promises as fs } from 'fs';
import MemoryMap from 'nrf-intel-hex';
import { EOL } from 'os';

export default async function writeCalibrationBlock(filename: string, block: Buffer) {
  const mem = new MemoryMap();

  mem.set(0x4f80, block);

  return fs.writeFile(filename, mem.asHexString().replace(/\n/g, EOL) + EOL);
}
