module.exports = {
  extends: [
    // Add recommended react linting
    'plugin:react/recommended',

    'prettier/react',
  ],

  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },

  settings: {
    react: {
      // Automatically detect the version of React to use.
      // Don't use the builtin automatic because it fails and gives a warning
      version: require('react').version,
    },
  },

  plugins: ['react-hooks'],

  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    '@typescript-eslint/explicit-function-return-type': 'off',

    // TODO: Want this rule?
    'react/no-unescaped-entities': 'warn',
  },
};
