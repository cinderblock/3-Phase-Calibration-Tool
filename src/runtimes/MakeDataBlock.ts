'use strict';

import USB, { addAttachListener, CommandMode, MLXCommand, Command } from 'smooth-control';

import { v1 as uuid } from 'uuid';

import readline from 'readline';
import { createReadStream, createWriteStream, writeFileSync } from 'fs';
import { EOL } from 'os';
import DataIDBlock from '../processes/DataIDBlock';
import chalk from 'chalk';
import MemoryMap from 'nrf-intel-hex';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import ChartjsNode from 'chartjs-node';

const chartWidth = 600;
const chartHeight = chartWidth;

const cyclesPerRev = 15;
const revolutions = 1;

const cycle = 3 * 256;

const maxAmplitude = 45;

const rawDataFilename = 'data.csv';
