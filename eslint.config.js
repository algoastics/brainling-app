const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'node_modules/*', 'expo-env.d.ts'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'wip', 'xxx', 'hack'], location: 'anywhere' },
      ],
    },
  },
]);
