import { createWriteStream } from 'fs';
import { EOL } from 'os';
import { ProcessedData } from '../../processes/Calibration';

export default async function writeSortedDataToFile(filename: string, processed: ProcessedData) {
  const out = createWriteStream(filename);
  out.write('step,forward,reverse' + EOL);
  for (let i = 0; i < processed.forwardData.length; i++) {
    out.write(`${i},${processed.forwardData[i]},${processed.reverseData[i]}${EOL}`);
  }
  out.close();
}
