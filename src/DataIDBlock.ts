import { crc16 } from 'crc';
import { v1 as uuid } from 'uuid';

type Options = {
  /**
   * Full step -> 14-bit angle mapping
   */
  lookupTable: number[];
  calibrationTime: Date;
  serial?: string;
};

const TableSize = 8 * 1024;
const IDSize = 128;

/**
 * Generates a block of memory that matches Calibration and ID Page described in Boot Map.svg
 */
export default function DataIDBlock({
  lookupTable,
  calibrationTime,
  serial,
}: Options) {
  const data = Buffer.allocUnsafe(TableSize + IDSize);

  const table = data.slice(0, TableSize);
  const ID = data.slice(TableSize);

  lookupTable.forEach((element, i) => {
    table.writeUInt16LE(element, i * 2);
  });

  let pos = 0;
  function write(length: number, num: number, signed = false) {
    (signed ? ID.writeIntLE : ID.writeUIntLE).bind(ID)(
      num,
      pos,
      Math.min(length, 6)
    );

    pos += length;

    let missing = length - Math.min(length, 6);

    while (missing) {
      ID[pos - missing] = 0;
      missing--;
    }
  }

  if (!serial || serial == 'None') serial = uuid();

  write(2, crc16(table, 0xffff));

  write(1, 0x00);

  write(8, calibrationTime.valueOf(), true);

  const USBStringSizePos = pos++;

  write(1, 0x03); // DTYPE_String

  const USBStringBuffer = ID.slice(pos, -2);
  USBStringBuffer.fill(0);
  const SerialSize = USBStringBuffer.write(
    serial,
    0,
    USBStringBuffer.length,
    'utf16le'
  );
  ID[USBStringSizePos] = SerialSize;

  const writtenSerial = USBStringBuffer.toString('utf16le', 0, SerialSize);

  if (writtenSerial != serial) {
    console.log('Serial number truncated:', writtenSerial);
  }

  pos = ID.length - 2;
  write(2, crc16(ID.slice(0, -2), 0xffff));

  return data;
}
