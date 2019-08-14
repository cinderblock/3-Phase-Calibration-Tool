# 3-Phase-Calibration-Tool

Generates memory .hex file of lookup table data and ID page.

## Running

Some values need to be configured before running:

- `data` needs to be collected via USB or from a previously recorded dataset
- `cyclesPerRev` needs to be accurate
- `Revs` specifies the number of revolutions to collect redundant calibration data for

## Plot outputs

In order for plotting outputs to work properly, `chartjs-node`'s dependencies need to be installed.
This mainly means that **Cairo** needs to be installed.
See below for OS specific Cairo setup instructions

## Windows

### Cairo

_Original Instructions: https://github.com/Automattic/node-canvas/wiki/Installation:-Windows_

1. `npm install --global --production windows-build-tools` in an admin shell
1. Extract GTK2 to `C:\GTK` (includes Cairo)
   - [Win32](http://ftp.gnome.org/pub/GNOME/binaries/win32/gtk+/2.24/gtk+-bundle_2.24.10-20120208_win32.zip) or [Win64](http://ftp.gnome.org/pub/GNOME/binaries/win64/gtk+/2.22/gtk+-bundle_2.22.1-20101229_win64.zip)
1. Install [libjpeg-turbo](http://sourceforge.net/projects/libjpeg-turbo/files/) to default location (`C:\libjpeg-turbo` or `C:\libjpeg-turbo64`, 32/64 must match GTK)
1. Install `canvas` with `yarn`

### USB Drivers

Since we're still using non-standard USB VID/PID, we need to install some slightly non-standard drivers.

#### zadig

Use [Zadig](http://zadig.akeo.ie/) to install the _WinUSB_ driver for our USB device.
Otherwise you will get `LIBUSB_ERROR_NOT_SUPPORTED`, `LIBUSB_ERROR_INVALID_PARAM`, or other similar errors when attempting to open devices.

1. After launching Zadig, `Options` -> `List All Devices`
1. Select "LMR Quantum Driver" from drop down
1. Click "Replace Driver"
   - "You are about to modify a system driver. Are you sure this is what you want?" Yes

## Linux

Known working set of needed packages:

```bash
sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg8-dev libgif-dev librsvg2-dev
```
