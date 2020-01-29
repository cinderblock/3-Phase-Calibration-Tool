import { DataPoint } from '../DataPoint';
import { DataFormat } from './DataFormat';
import USBInterface, { CommandMode, MLXCommand, Command, ReadData, isManualState } from 'smooth-control';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import { delay } from '../utils/delay';
import PositiveModulus from '../utils/PositiveModulus';
import percent from '../utils/percent';

// TODO: import from smooth-control
const cycle = 3 * 256;

const stepSize = 1;

export default async function loadDataFromUSB(
  serial: string,
  cyclePerRev: number,
  revolutions: number,
  maxAmplitude: number,
  logger: (step: number, dir: number, data: DataPoint) => void,
): Promise<DataFormat> {
  return new Promise((resolve, reject) => {
    const forward: DataPoint[] = [];
    const reverse: DataPoint[] = [];
    const usb = USBInterface(serial);

    // Non-inclusive last step of calibration routine
    const End = cycle * cyclePerRev * revolutions;

    const mode = CommandMode.Calibration;

    // Running smoothed version of alpha value
    let alpha: number;

    // Current calibration direction
    let dir = stepSize;

    // Ramp amplitude up slowly
    let amplitude = 0;

    // Start below "0" to give mechanics time to settle
    let step = -cycle;

    const GetAlpha: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({
        opcode: Opcode.GET1,
        marker: Marker.Alpha,
        data16: [, 0xffff],
      }),
    };
    const GetXYZ: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({
        opcode: Opcode.GET1,
        marker: Marker.XYZ,
        data16: [, 0xffff],
      }),
    };
    const MLXNOP: MLXCommand = {
      mode: CommandMode.MLXDebug,
      data: makePacket({ opcode: Opcode.NOP__Challenge }),
    };

    function sendCommand(command: Command) {
      const res = usb.write(command);

      if (!res) throw new Error('Motor disconnected?');

      return res.then(
        () => true,
        e => {
          console.log('Motor error:', e);
          return false;
        },
      );
    }

    let errors = 0;
    setInterval(() => {
      if (errors > 0) errors -= 0.1;
    }, 100);

    function maybeThrow(message: string) {
      errors++;
      if (errors < 5) {
        console.error('Error suppressed:', message);
        return;
      }
      throw message;
    }

    function getData() {
      return new Promise<ReadData>(resolve => {
        const once = usb.onData(data => {
          once();
          resolve(data);
        });
      });
    }

    const statusOnce = usb.onStatus(async s => {
      if (s != 'connected') return;

      statusOnce();

      // Motor connected

      console.log('Starting');

      await usb.write({ mode: CommandMode.ClearFault });

      let lastPrint;

      while (true) {
        await sendCommand(GetAlpha);
        // Give sensor time to make reading
        await delay(3);
        await sendCommand(GetXYZ);

        const xyzDelay = delay(3);

        // Force AVR USB to update USB buffer data once
        let data = await getData();

        do {
          data = await getData();
          if (!data) throw new Error('Data missing');
          if (!isManualState(data)) throw new Error('Motor fault!');
        } while (!data.mlxDataValid || !data.mlxParsedResponse);

        if (typeof data.mlxParsedResponse == 'string') {
          maybeThrow('MLX data parsing error: ' + data.mlxParsedResponse);
          continue;
        }

        if (!data.mlxParsedResponse.crc) {
          maybeThrow('data crc fail');
          continue;
        }

        if (data.mlxParsedResponse.marker == Marker.Opcode) {
          if (data.mlxParsedResponse.opcode == Opcode.Error_frame) {
            console.log(
              'Error frame. Error:',
              data.mlxParsedResponse.error === undefined ? 'undefined??' : ErrorCode[data.mlxParsedResponse.error],
            );
            maybeThrow('Received Error Frame');
            continue;
          }

          if (data.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
            maybeThrow('Nothing to transmit');
            continue;
          }

          maybeThrow('Why are we getting an OpCode response?');
          continue;
        }

        if (data.mlxParsedResponse.marker !== Marker.Alpha) {
          maybeThrow('Not alpha type message?!?');
          continue;
        }

        if (data.mlxParsedResponse.alpha === undefined) throw new Error('Parsing failure? - Alpha');

        const { current, cpuTemp: temperature, AS, BS, CS } = data;

        const { alpha, vg: VG } = data.mlxParsedResponse;

        await xyzDelay;

        await sendCommand(MLXNOP);

        // Force AVR USB to update USB buffer data once
        let dataXYZ = await getData();

        do {
          dataXYZ = await getData();
          if (!dataXYZ) throw new Error('XYZ data missing');
          if (!isManualState(dataXYZ)) throw new Error('Motor fault!');
        } while (!dataXYZ.mlxDataValid || !dataXYZ.mlxParsedResponse);

        if (typeof dataXYZ.mlxParsedResponse == 'string') {
          maybeThrow('MLX data parsing error: ' + dataXYZ.mlxParsedResponse);
          continue;
        }

        if (!dataXYZ.mlxParsedResponse.crc) {
          maybeThrow('dataxyz crc fail');
          continue;
        }

        if (dataXYZ.mlxParsedResponse.marker == Marker.Opcode) {
          if (dataXYZ.mlxParsedResponse.opcode == Opcode.Error_frame) {
            console.log(
              'Error frame. Error:',
              dataXYZ.mlxParsedResponse.error === undefined
                ? 'undefined??'
                : ErrorCode[dataXYZ.mlxParsedResponse.error],
            );
            maybeThrow('Received Error Frame XYZ');
            continue;
          }

          if (dataXYZ.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
            maybeThrow('Nothing to transmit XYZ');
            continue;
          }
        }

        if (dataXYZ.mlxParsedResponse.marker !== Marker.XYZ) {
          maybeThrow('Not alpha type message?!?');
          continue;
        }

        const { x, y, z, computed } = dataXYZ.mlxParsedResponse;

        if (x === undefined) throw new Error('Parsing failure? - x');
        if (y === undefined) throw new Error('Parsing failure? - y');
        if (z === undefined) throw new Error('Parsing failure? - z');

        // Only record data in range of good motion
        if (step >= 0 && step < End) {
          (dir > 0 ? forward : reverse)[step] = {
            alpha,
            x,
            y,
            z,
            current,
            temperature,
            AS,
            BS,
            CS,
            VG,
          };

          logger(step, dir, {
            alpha,
            x,
            y,
            z,
            current,
            temperature,
            AS,
            BS,
            CS,
            VG,
          });
        }

        // Keep going one cycle past the End before turning around
        if (dir > 0 && step > End + cycle / 2) {
          console.log('Reversing');
          dir = -dir;
        }

        // All done
        if (dir < 0 && step <= 0) {
          const time = new Date();

          await sendCommand({ mode, amplitude: 0, angle: 0 });

          // usb.close();
          // console.log('USB closed');

          resolve({ forward, reverse, time });
          break;
        }

        // Normal step
        step += dir;

        // Ramp amplitude up
        if (amplitude < maxAmplitude) amplitude++;

        const angle = PositiveModulus(step, cycle);

        // Print status updates at logarithmic periods
        const temp = Math.round(Math.log(cycle + 50 + step || 1) / Math.log(1.25));

        if (temp !== lastPrint) {
          console.log(
            percent(dir > 0 ? step / End / 2 : 1 - step / End / 2),
            'At step:',
            step,
            'mag:',
            alpha,
            'Temp:',
            data.cpuTemp,
            'Current:',
            data.current,
            'VG:',
            VG,
          );
          lastPrint = temp;
        }

        await sendCommand({ mode, amplitude, angle });
      }
    });
  });
}
