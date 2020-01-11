let target = 'web';

// TODO: make this test work correctly
if (process.env.REACT_APP_MODE === 'electron' || true) {
  target = 'electron-renderer';
}
console.log(`craco.config.js: setting webpack target to: ${target}`);
module.exports = {
  webpack: {
    configure: {
      target,
    },
  },
};
