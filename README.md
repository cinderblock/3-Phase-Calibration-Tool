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

# electron-react-ts-starter

#### ( Has Auto Reloading and Works with Create-React-App )

This is a boiler plate starter pack when starting an electron project which uses react with typescript. The code contains some bug fixes that are found when using react with electron and typescript and has auto monitoring of typescript changes to reload the electron app for faster development.

### Why this electron-react-ts-starter :

- Run electron app with create-react-app without ejecting.
- Auto reloads the electron app when the typescript source file changes. (This is missing in a lot of tutorial articles which only have an electron.js file and not a electron.ts file )
- Provides the required npm scripts and folder structure for simple to complex projects.
- Includes a very simple bundling process.
- Auto reloads app for changes in both main process files and react files.
- With the provided folder structure , main and renderer process codebase can be maintained independently.

## Usage :

##### Run the react project from the renderer directory :

```js
cd renderer
npm install // First time only
npm run start
```

##### Run electron app's main process from main directory :

```js
cd main
npm install // First time only
npm run start
```

## To Build and Bundle :

- Just make sure that you have added all the dependencies in the `main/package.json` to the `renderer/package.json` and the run the below command from the `renderer` folder.

```js
cd renderer
npm run release // or npm run build
```

**Sit back and have a cup of Coffee while the app gets built** .

You will now have a full fledged application waiting for you in the `dist` folder.

---

### Misc And Extra Options :

- If your app uses React Router , make sure you use `HashRouter` instead of `BrowserRouter` .
- In the `renderer/package.json` , use the `build` property to modify the settings for electron-builder. All assets and static files in your project should be present in the `assets` folder.
- To get different installer types like 'msi' , 'appx' , '7z' , 'zip' etc , change the `target` property inside the `build` property in `renderer/package.json` .
- If you have nested structure of typescript files in the `main` folder , make sure that you copy all the generated javascript `.js` files into the `renderer/public/` folder before building the react app (This would add the javascript files in the public folder into the build folder when building our react-app).

### Project built using this pack :

[Windows Terminal Tweaker](https://github.com/nateshmbhat/windows-terminal-tweaker)

# Node Server UI base

Skeleton for a sever/client TypeScript pair.

## Details

This skeleton has 3 parts.

1. A super simple node.js daemon skeleton with socket.io and colorful logging facilities.
2. Basic React app skeleton with webpack, TypeScript, and socket.io client (with fancy state synchronization).
3. Deployment scripts

## create-node-server-ui-app

Simple steps to make a new project/app based on this skeleton.

1. clone
1. Update `README.md` and `package.json`
1. `git commit -am 'Initial commit'`

## Development

The development environment is intended to be a first class and modern.

- Reload on save for client ui and server daemon running locally or remotely.
- Full color easy console logging.
- Easy debugging with source maps everywhere.
- ESLint configured and integrated with editor
- Dependency changes automatically maintained with git hooks.

### Prerequisites

[**Node 10+**](https://nodejs.org/en/download) must be installed on your development system.
[**Yarn**](https://yarnpkg.com/lang/en/docs/install) is nice to have but **optional**.

### Setup

Install dependencies and setup development environment.

```bash
yarn setup
```

#### Non-global Yarn?

While easier if Yarn is installed globally, this works fine without it.

```bash
# Installs yarn locally
npm install
# Setup development environment
npm run setup
```

> You can run any command from the cheat sheet by replacing `yarn` with `npm run`.

### Running

To run this full system, **two** separate programs need to be run.
One for the web **UI** and one to actually do something persistent, the **daemon**.

### Remote Execution

Configs for daemons often need to be slightly different than when running locally.
The deploy script will pick a config file from [`daemon/configs/`](daemon/configs).

### Suggested Environment

Use Visual Studio Code.

### Cheat sheet

All of these are run from the top level directory.

| Command                    | Description                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `yarn`                     | Setup your local machine for development                                              |
| `yarn ui start`            | Run the web **ui** on your local machine (_dev mode_)                                 |
| `yarn main start`          | Run **daemon** locally in watch mode with most recent local code                      |
| `yarn deploy daemon-dev`   | Run local compiler in watch mode and **daemon** on remote with most recent local code |
| `yarn ui add some-package` | Add `some-package` to the ui                                                          |
| `yarn ui upgrade`          | Upgrade ui packages to latest versions                                                |
| `yarn upgrade-all`         | Upgrade all packages to latest versions                                               |
| `yarn check-files`         | Check all installed packages for errors                                               |

### Raspberry Pi Setup

Some commands need to be run on the target Raspberry Pi manually once.

```bash
# Install needed dependencies
sudo apt install -y build-essential libudev-dev libcurl4-gnutls-dev nodejs yarn

# Make our USB devices owned by pi/dialout
(
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="dead", ATTR{idProduct}=="beef", GROUP="dialout", OWNER="pi", MODE="0660"'
) | sudo tee /etc/udev/rules.d/usb-motor.rules > /dev/null
```
