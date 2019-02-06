# 3-Phase-Calibration-Tool

## Running

Some values need to be configured before running:

- `data` needs to be collected via USB or from a previously recorded dataset
- `cyclesPerRev` needs to be accurate
- `Revs` specifies the number of revolutions to collect redundant calibration data for

## Windows

Use [Zadig](http://zadig.akeo.ie/) to install the WinUSB driver for your USB device.
Otherwise you will get `LIBUSB_ERROR_NOT_SUPPORTED` when attempting to open devices.
