# How to use multiple configs

The deploy code (`yarn deploy daemon-dev`) looks at its config to pick which file in here shall be used on the deployed system.

## New config

Just copy one of the `.ts` files in this directory and give it a new name.
Make a new config in `deploy/` that points to it.

## Include

### Using Configurations

Include [`Config`](../Config.ts):

```TypeScript
import config from './Config';
```

## How it works

The [`deploy`](../../deploy) system effectively creates a new `config.ts` with the following contents:

```TypeScript
export { default } from `./${selectedConfig}`;
```
