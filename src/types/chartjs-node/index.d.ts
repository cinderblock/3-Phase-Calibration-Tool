// Type definitions for chartjs-node
// Project:
// Definitions by: Cameron Tacklind <cameron@tacklind.com> (https://github.com/cinderblock)
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import Chartjs, { ChartOptions, ChartConfiguration } from 'chart.js';
import { Readable } from 'stream';

export type ExportType = 'image/png';

export default class ChartjsNode {
  constructor(width: number, height: number);

  destroy(): void;

  drawChart(chartJsOptions: ChartConfiguration): Promise<void>;

  writeImageToFile(type: ExportType, file: string): Promise<void>;

  getImageBuffer(type: ExportType): Promise<Buffer>;

  getImageStream(type: ExportType): Promise<Readable>;

  getImageDataUrl(type: ExportType): Promise<string>;

  // .on('beforeDraw',...)
}
