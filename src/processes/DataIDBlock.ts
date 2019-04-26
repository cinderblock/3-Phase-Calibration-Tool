import { crc16 } from 'crc';

type Options = {
  /**
   * Full step -> 14-bit angle mapping
   */
  lookupTable: number[];
  calibrationTime: Date;
  serial: string;
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
  // The block of data that we return.
  const data = Buffer.allocUnsafe(TableSize + IDSize);

  // Get a sub-buffer that is just the lookup table
  const table = data.slice(0, TableSize);
  // Get a sub-buffer that is just the ID/data block
  const ID = data.slice(TableSize);

  // Fill the lookup table block
  lookupTable.forEach((element, i) => {
    table.writeUInt16LE(element, i * 2);
  });

  let pos = 0;
  // Helper function to write a bunch of variable length values sequentially to the buffer
  function write(length: number, num: number, signed = false) {
    // Get signed or unsigned version of write int function
    const writeInt = (signed ? ID.writeIntLE : ID.writeUIntLE).bind(ID);

    // Node does not support length > 6
    const realLength = Math.min(length, 6);

    // Write the actual value
    writeInt(num, pos, realLength);

    // Increment our buffer index
    pos += length;

    // Count how many bytes we skipped
    let missing = length - realLength;

    // Fill in any missing zero bytes
    while (missing) {
      ID[pos - missing] = 0;
      missing--;
    }
  }

  // Write the CRC16 of the lookup table as first word
  write(2, crc16(table, 0xffff));

  // Write a ID block version number
  write(1, 0x00);

  // Write calibration time
  write(8, calibrationTime.valueOf(), true);

  // We will be writing USB String Length to this position. Not sure what it is yet.
  const USBStringSizePos = pos++;

  // USB Spec says first byte of data block specifies data type
  write(1, 0x03); // DTYPE_String

  // Get a sub-buffer that is the amount of room we have left
  const USBStringBuffer = ID.slice(pos, -2);
  // Fill with blanks, just in case
  USBStringBuffer.fill(0);

  // Write our serial number to the data block and record actual length written
  const SerialSize = USBStringBuffer.write(
    serial,
    0,
    USBStringBuffer.length,
    'utf16le'
  );

  // Record serial length at expected location
  ID[USBStringSizePos] = SerialSize + 2;

  // Read back the written serial to confirm no encoding issues
  const writtenSerial = USBStringBuffer.toString('utf16le', 0, SerialSize);

  // Warn user if specified serial number was too long to fit in ID block.
  if (writtenSerial != serial) {
    console.log('Serial number truncated:', writtenSerial);
  }

  // Put a CRC16 at the end of the block
  pos = ID.length - 2;
  write(2, crc16(ID.slice(0, -2), 0xffff));

  return data;
}
