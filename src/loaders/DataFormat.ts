import { DataPoint } from '../DataPoint';

export type DataFormat = {
  forward: DataPoint[];
  reverse: DataPoint[];
  time: Date;
};
