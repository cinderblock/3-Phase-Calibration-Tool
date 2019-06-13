# 3-Phase-Calibration-Tool

Generates memory .hex file of lookup table data and ID page.

## Running

Some values need to be configured before running:

- `data` needs to be collected via USB or from a previously recorded dataset
- `cyclesPerRev` needs to be accurate
- `Revs` specifies the number of revolutions to collect redundant calibration data for

## Windows

Use [Zadig](http://zadig.akeo.ie/) to install the WinUSB driver for your USB device.
Otherwise you will get `LIBUSB_ERROR_NOT_SUPPORTED` when attempting to open devices.

## Linux

Known working set of needed packages:

```bash
sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg8-dev libgif-dev librsvg2-dev
```
