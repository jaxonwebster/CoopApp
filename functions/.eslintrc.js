module.exports = {
  env: {
    node: true,
    es2022: true,
  },

  extends: [
    'eslint:recommended',
  ],

  parserOptions: {
    ecmaVersion: 'latest',
  },

  rules: {
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],

    'object-curly-spacing': [
      'error',
      'never',
    ],

    quotes: [
      'error',
      'single',
    ],

    semi: [
      'error',
      'always',
    ],
  },
};