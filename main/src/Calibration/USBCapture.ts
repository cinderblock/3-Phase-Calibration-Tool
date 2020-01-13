import { DataPoint } from './DataPoint';
import { DataFormat } from './DataFormat';
import USBInterface, { CommandMode, MLXCommand, Command, ReadData, isFaultState, isManualState } from 'smooth-control';
import { makePacket, Opcode, Marker, ErrorCode } from 'mlx90363';
import { delay } from '../utils/PromiseDelay';
import CircularRange from '../utils/CircularRange';
import percent from '../utils/percent';

// TODO: import from smooth-control
const countsPerCycle = 3 * 256;

const stepSize = 1;

enum CalibrationStep {
  Cycles,
  CyclesWait,
  MLXResponseAlphaWait,
  MLXResponseAlpha,
  MLXResponseXYZWait,
  MLXResponseXYZ,
  DataUnit,
}

type DiscoveredCyclesWait = {
  step: CalibrationStep.CyclesWait;
};

type DiscoveredCycles = {
  step: CalibrationStep.Cycles;
  cyclesPerRevolution: number;
};

type MLXResponseAlphaWaitStep = {
  step: CalibrationStep.MLXResponseAlphaWait;
};

type MLXResponseXYZWaitStep = {
  step: CalibrationStep.MLXResponseXYZWait;
};

type CalibrationStepData = {
  step: number;
  dir: number;
  end: number;
  amplitude: number;
};

type MLXResponseAlphaStep = {
  step: CalibrationStep.MLXResponseAlpha;
  calibration: CalibrationStepData & { alpha: number };
};

type MLXResponseXYZStep = {
  step: CalibrationStep.MLXResponseXYZ;
  calibration: CalibrationStepData & { x: number; y: number; z: number };
};

type DataUnitStep = {
  step: CalibrationStep.DataUnit;
  calibration: CalibrationStepData & DataPoint;
};

type Step =
  | DiscoveredCyclesWait
  | DiscoveredCycles
  | MLXResponseAlphaWaitStep
  | MLXResponseAlphaStep
  | MLXResponseXYZWaitStep
  | MLXResponseXYZStep
  | DataUnitStep;

type RunningInput = {
  speed?: number;
  amplitude?: number;
  reset?: boolean;
};

export default async function* loadDataFromUSB(
  device: ReturnType<typeof USBInterface>,
  revolutions = 2,
  maxAmplitude = 30,
): AsyncGenerator<Step, DataFormat, RunningInput | void> {
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
  const NoOp: MLXCommand = {
    mode: CommandMode.MLXDebug,
    data: makePacket({ opcode: Opcode.NOP__Challenge }),
  };

  function sendCommand(command: Command): Promise<void> {
    return new Promise(async res => {
      const sent = device.write(command);

      if (!sent) throw new Error('Communications lost');

      await sent;

      res();
    });
  }

  let errors = 0;
  setInterval(() => {
    if (errors > 0) errors -= 0.1;
  }, 100);

  function maybeThrow(message: string): void {
    errors++;
    if (errors < 5) {
      console.error('Error suppressed:', message);
      return;
    }
    throw message;
  }

  function getData(timeout = 1000): Promise<ReadData> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let watchdog: NodeJS.Timeout;

      const once = device.onData(data => {
        clearTimeout(watchdog);
        once();
        resolve(data);
      });

      watchdog = setTimeout(() => {
        once();
        reject();
      }, timeout);
    });
  }

  const forward: DataPoint[] = [];
  const reverse: DataPoint[] = [];

  let cyclesPerRevolution = 0;

  // Amplitude automatically ramps up slowly at the start of the run
  let amplitude = 0;

  function resume(input: RunningInput | void): void {
    if (!input) return;

    if (input.amplitude !== undefined) maxAmplitude = amplitude = input.amplitude;
    if (input.speed !== undefined) console.log('not yet implemented');
    if (input.reset !== undefined) console.log('not yet implemented');
  }

  while (true) {
    cyclesPerRevolution++;
    if (cyclesPerRevolution > 255) throw new Error('Could not detect cycles');

    await sendCommand({ mode: CommandMode.Calibration, amplitude: 0, angle: countsPerCycle * cyclesPerRevolution });

    let data = await getData();
    data = await getData();

    if (isFaultState(data)) throw new Error('Motor fault!');

    if (!isManualState(data)) throw new Error('Wrong state!');

    if (data.position === 0) {
      // Found it!
      break;
    }

    resume(yield { step: CalibrationStep.CyclesWait });
  }

  resume(yield { step: CalibrationStep.Cycles, cyclesPerRevolution });

  const countsPerRevolution = countsPerCycle * cyclesPerRevolution;

  const motorRange = CircularRange(countsPerRevolution);

  // Non-inclusive last step of calibration routine
  const end = countsPerRevolution * revolutions;

  // Current calibration direction
  let dir = stepSize;

  // Start below "0" to give mechanics time to settle
  let step = -countsPerCycle;

  console.log('Starting');

  let lastPrint;

  while (true) {
    await sendCommand(GetAlpha);
    // Give sensor time to make reading
    await delay(2);
    await sendCommand(GetXYZ);

    const xyzDelay = delay(1);

    // Force AVR USB to update USB buffer data once
    let data = await getData();

    while (true) {
      data = await getData();
      if (!data) throw new Error('Data missing');
      if (isFaultState(data)) throw new Error('Motor fault!');
      if (isManualState(data)) {
        if (data.mlxDataValid && data.mlxParsedResponse) break;
        resume(yield { step: CalibrationStep.MLXResponseAlphaWait });
        continue;
      }
      throw new Error('Wrong state!');
    }

    if (typeof data.mlxParsedResponse == 'string') {
      maybeThrow('MLX data parsing error: ' + data.mlxParsedResponse);
      continue;
    }

    if (!data.mlxParsedResponse.crc) {
      maybeThrow('data crc fail');
      continue;
    }

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

    if (data.mlxParsedResponse.alpha === undefined) throw new Error('Parsing failure? - Alpha');

    const { current, cpuTemp: temperature, AS, BS, CS } = data;

    const { alpha, vg: VG } = data.mlxParsedResponse;

    resume(yield { step: CalibrationStep.MLXResponseAlpha, calibration: { step, dir, alpha, end, amplitude } });

    await xyzDelay;

    await sendCommand(NoOp);

    // Force AVR USB to update USB buffer data once
    let dataXYZ = await getData();

    while (true) {
      dataXYZ = await getData();
      if (!dataXYZ) throw new Error('XYZ data missing');
      if (isFaultState(dataXYZ)) throw new Error('Motor fault!');
      if (isManualState(dataXYZ)) {
        if (dataXYZ.mlxDataValid && dataXYZ.mlxParsedResponse) break;
        resume(yield { step: CalibrationStep.MLXResponseXYZWait });
        continue;
      }
      throw new Error('Wrong state!');
    }

    if (typeof dataXYZ.mlxParsedResponse == 'string') {
      maybeThrow('MLX data parsing error: ' + dataXYZ.mlxParsedResponse);
      continue;
    }

    if (!dataXYZ.mlxParsedResponse.crc) {
      maybeThrow('dataxyz crc fail');
      continue;
    }

    if (dataXYZ.mlxParsedResponse.opcode == Opcode.Error_frame) {
      console.log(
        'Error frame. Error:',
        dataXYZ.mlxParsedResponse.error === undefined ? 'undefined??' : ErrorCode[dataXYZ.mlxParsedResponse.error],
      );
      maybeThrow('Received Error Frame XYZ');
      continue;
    }

    if (dataXYZ.mlxParsedResponse.opcode == Opcode.NothingToTransmit) {
      maybeThrow('Nothing to transmit XYZ');
      continue;
    }

    const { x, y, z } = dataXYZ.mlxParsedResponse;

    if (x === undefined) throw new Error('Parsing failure? - x');
    if (y === undefined) throw new Error('Parsing failure? - y');
    if (z === undefined) throw new Error('Parsing failure? - z');

    resume(yield { step: CalibrationStep.MLXResponseXYZ, calibration: { step, dir, x, y, z, end, amplitude } });

    // Only record data in range of good motion
    if (step >= 0 && step < end) {
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

      resume(
        yield {
          step: CalibrationStep.DataUnit,
          calibration: {
            step,
            dir,
            amplitude,
            end,
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
          },
        },
      );
    }

    // Keep going one cycle past the End before turning around
    if (dir > 0 && step > end + countsPerCycle / 2) {
      console.log('Reversing');
      dir = -dir;
    }

    // All done
    if (dir < 0 && step <= 0) {
      const time = new Date();

      await sendCommand({ mode: CommandMode.Calibration, amplitude: 0, angle: 0 });

      // usb.close();
      // console.log('USB closed');

      return { forward, reverse, time };
    }

    // Normal step
    step += dir;

    // Ramp amplitude up
    if (amplitude < maxAmplitude) amplitude++;

    const angle = motorRange.normalize(step);

    // Print status updates at logarithmic periods
    const temp = Math.round(Math.log(countsPerCycle + 50 + step || 1) / Math.log(1.25));

    if (temp !== lastPrint) {
      console.log(
        percent(dir > 0 ? step / end / 2 : 1 - step / end / 2),
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

    await sendCommand({ mode: CommandMode.Calibration, amplitude, angle });
  }
}
