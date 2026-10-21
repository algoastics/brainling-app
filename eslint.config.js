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
    files: ['**/*.plugin.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', require: 'readonly', module: 'writable' },
    },
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
