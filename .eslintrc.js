module.exports = {
  root: true,

  extends: [
    // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:@typescript-eslint/recommended',

    // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'prettier/@typescript-eslint',

    // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors.
    // Make sure this is always the last configuration in the extends array.
    'plugin:prettier/recommended',
  ],

  parserOptions: {
    parser: '@typescript-eslint/parser',
    sourceType: 'module',
  },

  rules: {
    // Make auto-fixable prettier issues less obtrusive
    'prettier/prettier': [
      'warn',
      {
        parser: 'typescript',
      },
    ],

    '@typescript-eslint/camelcase': 'warn',
    '@typescript-eslint/no-use-before-define': 'warn',
    // Silly rule
    '@typescript-eslint/no-empty-function': 'off',
  },

  "overrides": [
    {
      "files": ["*.js", "*.jsx"],
      "rules": {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};
