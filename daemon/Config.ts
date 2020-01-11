/**
 * Device specific configurations
 */
export type Config = {
  // Fill what you expect configs to set here
};

// You can ignore this missing file if you're not running locally
import localConfig from './configs/config';
// Help with types in case the above import fails
const typedConfig: Config = localConfig;
export default typedConfig;
