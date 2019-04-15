import { createWriteStream } from 'fs';
import { EOL } from 'os';

import { ProcessedData } from '../../processes/Calibration';

export default async function writeSmoothedDataToFile(filename: string, processed: ProcessedData) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse,middle' + EOL);
  for (let i = 0; i < processed.forward.length; i++) {
    out.write(`${i},${processed.forward[i]},${processed.reverse[i]},${processed.middle[i]}${EOL}`);
  }
  out.close();
}
