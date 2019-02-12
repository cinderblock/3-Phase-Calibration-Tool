import EventEmitter from 'events';
import { promisify } from 'util';
import chalk from 'chalk';
import usb, { InEndpoint } from 'usb';
// import StrictEventEmitter from './strict-event-emitter-types';

import clipRange from './clipRange';

const deviceVid = 0xdead;
const devicePid = 0xbeef;

// Must match REPORT_SIZE
const reportLength = 29;

function isDeviceMotorDriver(device: usb.Device) {
  const dec = device.deviceDescriptor;
  const ven = dec.idVendor;
  const prod = dec.idProduct;
  return ven == deviceVid && prod == devicePid;
}

export type MLXCommand = {
  mode: 'MLX';
  data: Buffer;
  crc?: boolean;
};

export type ThreePhaseCommand = {
  mode: 'ThreePhase';
  A: number;
  B: number;
  C: number;
};

export type CalibrationCommand = {
  mode: 'Calibration';
  angle: number;
  amplitude: number;
};

export type PushCommand = {
  mode: 'Push';
  command: number;
};

export type ServoCommand = {
  mode: 'Servo';
  command: number;
  pwmMode:
    | 'pwm'
    | 'position'
    | 'velocity'
    | 'spare'
    | 'command'
    | 'kP'
    | 'kI'
    | 'kD';
};

export type Command =
  | MLXCommand
  | ThreePhaseCommand
  | CalibrationCommand
  | PushCommand
  | ServoCommand;

// Matches main.hpp State
export enum ControllerState {
  Fault,
  MLXSetup,
  Manual,
  Calibration,
  Push,
  Servo,
}

// Matches main.hpp Fault
export enum ControllerFault {
  Init,
  InvalidCommand,
  OverCurrent,
  OverTemperature,
}

export type ReadData = {
  state: ControllerState;
  fault: ControllerFault;
  position: number;
  velocity: number;
  // Store full word. Get the low 14 bits as actual raw angle
  rawAngle: number;
  // Top bit specifies if controller thinks it is calibrated
  calibrated: boolean;
  cpuTemp: number;
  current: number;
  ain0: number;
  AS: number;
  BS: number;
  CS: number;
  mlxResponse: Buffer;
  localMLXCRC: boolean;
};

interface Events {
  data(arg: ReadData): void;
  error(): Error;
  status(): 'ok' | 'missing';
}

async function openAndGetMotorSerial(dev: usb.Device) {
  if (!isDeviceMotorDriver(dev)) return false;

  // console.log('New Motor Device!');

  dev.open();

  const p = promisify(dev.getStringDescriptor.bind(dev)) as (
    i: number
  ) => Promise<Buffer | undefined>;

  try {
    let data = await p(dev.deviceDescriptor.iSerialNumber);

    if (!data) {
      dev.close();
      return false;
    }
    const dataStr = data
      .toString()
      .replace(/\0/g, '')
      .trim();

    // console.log('Found Motor device:', dataStr);

    return dataStr;
  } catch (e) {
    console.log(e);
  }
  return false;
}

type Options = {};

export function parseINBuffer(data: Buffer): ReadData | undefined {
  // console.log('data:', data);

  if (data.length != reportLength) {
    console.log('Invalid data:', data);
    return;
  }

  let i = 0;
  function read(length: number, signed: boolean = false) {
    const pos = i;
    i += length;
    if (signed) return data.readIntLE(pos, length);
    return data.readUIntLE(pos, length);
  }
  function readBuffer(length: number) {
    const ret = Buffer.allocUnsafe(length);
    i += data.copy(ret, 0, i);
    return ret;
  }

  let temp: number;

  // Matches USB/PacketFormats.h USBDataINShape
  return {
    state: read(1),
    fault: read(1),
    position: read(2),
    velocity: read(2, true),
    // Store full word. Get the low 14 bits as actual raw angle
    rawAngle: (temp = read(2)) & ((1 << 14) - 1),
    // Top bit specifies if controller thinks it is calibrated
    calibrated: !!(temp & (1 << 15)),
    cpuTemp: read(2),
    current: read(2, true),
    ain0: read(2),
    AS: read(2),
    BS: read(2),
    CS: read(2),
    mlxResponse: readBuffer(8),
    localMLXCRC: !!read(1),
  };
}

export async function addAttachListener(
  listener: (id: string, device: usb.Device) => void
) {
  async function checker(dev: usb.Device) {
    const serial = await openAndGetMotorSerial(dev);
    dev.close();
    if (serial === false) return;
    listener(serial, dev);
  }

  const checkExisting = Promise.all(usb.getDeviceList().map(checker));

  usb.on('attach', checker);

  await checkExisting;

  return () => {
    usb.removeListener('attach', checker);
  };
}

export default function USBInterface(id: string, options?: Options) {
  if (!id) throw new Error('Invalid ID');

  let device: usb.Device;
  const events = new EventEmitter(); // as StrictEventEmitter<EventEmitter, Events>;
  let enabled = false;

  let polling = true;

  function start(p = true) {
    polling = p;
    // When we start, find all devices
    usb.getDeviceList().forEach(checkDevice);
    // And listen for any new devices connected
    usb.on('attach', checkDevice);
  }

  async function checkDevice(dev: usb.Device) {
    const serial = await openAndGetMotorSerial(dev);
    if (serial != id) {
      dev.close();
      return;
    }
    console.log('Attaching:', id);

    usb.removeListener('attach', checkDevice);

    device = dev;

    // Motor HID interface is always interface 0
    const intf = device.interface(0);

    if (process.platform != 'win32' && intf.isKernelDriverActive())
      intf.detachKernelDriver();

    intf.claim();

    // Store interface number as first number in write buffer
    writeBuffer[0] = intf.interfaceNumber;

    // Motor HID IN endpoint is always endpoint 0
    const endpoint = intf.endpoints[0] as InEndpoint;

    if (polling) {
      // Start polling. 3 pending requests at all times
      endpoint.startPoll(3, reportLength);

      endpoint.on('data', d => events.emit('data', parseINBuffer(d)));
    }

    endpoint.on('error', err => {
      if (err.errno == 4) return;

      events.emit('error', err);
    });

    usb.on('detach', detach);

    enabled = true;

    events.emit('status', 'ok');

    // console.log('Motor', id, 'attached.');

    // hidDevice.controlTransfer(
    //   // bmRequestType
    //   usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_REQUEST_TYPE_STANDARD | usb.LIBUSB_ENDPOINT_OUT,
    //   // bmRequest
    //   usb.LIBUSB_REQUEST_SET_CONFIGURATION,
    //   // wValue (Configuration value)
    //   0,
    //   // wIndex
    //   0,
    //   // message to be sent
    //   Buffer.alloc(0),
    //   (err, data) => {
    //     if (err) {
    //       process.nextTick(() => events.emit('error', err));
    //       return;
    //     }
    //   }
    // );
  }

  // Allocate a write buffer once and keep reusing it
  const writeBuffer = Buffer.alloc(reportLength);

  function close() {
    (device.interface(0).endpoints[0] as InEndpoint).stopPoll();
    device && device.close();
  }

  function detach(dev: usb.Device) {
    if (dev != device) return;

    events.emit('status', 'missing');

    console.log(chalk.yellow('Detach'), id);

    usb.removeListener('detach', detach);
    usb.on('attach', checkDevice);

    enabled = false;
  }

  async function read() {
    if (!enabled || !device) {
      console.log(
        chalk.magenta('USBInterface not enabled.'),
        chalk.grey('Motor', id)
      );
      return false;
    }

    return new Promise<ReadData>((resolve, reject) => {
      device.controlTransfer(
        // bmRequestType (constant for this control request)
        usb.LIBUSB_REQUEST_TYPE_STANDARD |
          usb.LIBUSB_ENDPOINT_IN |
          usb.LIBUSB_RECIPIENT_DEVICE,
        // bmRequest (constant for this control request)
        0x08,
        // wValue (MSB is report type, LSB is report number)
        0,
        // wIndex (interface number)
        0,
        // Number of bytes to receive
        reportLength,
        (err, data) => {
          if (
            err ||
            // && err.errno != 4
            !data
          )
            reject(err);
          else resolve(parseINBuffer(data));
        }
      );
    });
  }

  /*
   * Writes data that is read by Interface.cpp CALLBACK_HID_Device_ProcessHIDReport
   */
  function write(command: Command, cb?: () => any) {
    if (!enabled || !device) {
      console.log(
        chalk.magenta('USBInterface not enabled:'),
        command,
        chalk.grey('Motor', id)
      );
      return false;
    }

    // Matches PacketFormats.h CommandMode
    const CommandMode = {
      MLXDebug: 0,
      ThreePhaseDebug: 1,
      Calibration: 2,
      Push: 3,
      Servo: 4,
    } as { [mode: string]: number };

    let pos = 1;
    function writeNumBuffer(num: number, len = 1, signed = false) {
      if (signed) pos = writeBuffer.writeIntLE(num, pos, len);
      else pos = writeBuffer.writeUIntLE(num, pos, len);
    }

    writeNumBuffer(CommandMode[command.mode]);

    try {
      switch (command.mode) {
        case 'MLX':
          if (command.data === undefined) throw 'Argument `data` missing';
          if (!(command.data.length == 7 || command.data.length == 8))
            throw 'Argument `data` has incorrect length';

          command.data.copy(writeBuffer, pos);
          pos += 8;
          const generateCRC = command.crc || command.data.length == 7;
          writeNumBuffer(generateCRC ? 1 : 0);
          break;

        case 'ThreePhase':
          if (command.A === undefined) throw 'Argument `A` missing';
          if (command.B === undefined) throw 'Argument `B` missing';
          if (command.C === undefined) throw 'Argument `C` missing';

          writeNumBuffer(command.A, 2);
          writeNumBuffer(command.B, 2);
          writeNumBuffer(command.C, 2);
          break;

        case 'Calibration':
          if (command.angle === undefined) throw 'Argument `angle` missing';
          if (command.amplitude === undefined)
            throw 'Argument `amplitude` missing';

          writeNumBuffer(command.angle, 2);
          writeNumBuffer(command.amplitude, 1);
          break;

        case 'Push':
          if (command.command === undefined) throw 'Argument `command` missing';
          writeNumBuffer(command.command, 2, true);
          break;

        case 'Servo':
          if (command.command === undefined) throw 'Argument `command` missing';
          if (command.pwmMode === undefined) throw 'Argument `pwmMode` missing';

          // CommandMode::Servo
          const PWMMode = {
            pwm: 1, // Set pwm Mode
            position: 2, // setPosition
            velocity: 3, // setVelocity
            spare: 4, // Spare Mode
            command: 1, // setAmplitude  // this is redundant to pwmMode
            // Here we set the control parameters.
            // Note that these are all u1 numbers
            kP: 11, // in USBInterface.cpp, send a Proportional Gain constant
            kI: 12,
            kD: 13,
          };

          writeNumBuffer(PWMMode[command.pwmMode]);

          switch (command.pwmMode) {
            case 'kP': // case 11: in USBInterface.cpp, send a Proportional Gain constant
            case 'kI': // case 12:
            case 'kD': // case 13:
              command.command = clipRange(0, 255)(command.command);
            case 'pwm': // case 1: Set pwm Mode
            case 'command': // case 1: setAmplitude  // this is redundant to pwmMode
              command.command = clipRange(-255, 255)(command.command);
            case 'position': // case 2: setPosition
            case 'velocity': // case 3: setVelocity
            case 'spare': // case 4: Set Spare Mode
              writeNumBuffer(command.command, 4, true);
              break;
          }
      }

      // Send a Set Report control request
      device.controlTransfer(
        // bmRequestType (constant for this control request)
        usb.LIBUSB_RECIPIENT_INTERFACE |
          usb.LIBUSB_REQUEST_TYPE_CLASS |
          usb.LIBUSB_ENDPOINT_OUT,
        // bmRequest (constant for this control request)
        0x09,
        // wValue (MSB is report type, LSB is report number)
        0x0809,
        // wIndex (interface number)
        0,
        // message to be sent
        writeBuffer,
        err => {
          if (err && err.errno != 4) events.emit('error', err);
          cb && cb();
        }
      );
    } catch (e) {
      console.log(chalk.red('Error:'));
      console.log(chalk.magenta(e));
      console.log(chalk.gray((command as unknown) as TemplateStringsArray));
      cb && cb();
    }
  }
  return { events, write, read, start, close };
}
