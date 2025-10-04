// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { import: importPlugin },
    rules: { 'no-unused-vars': 'warn' }
  }
];
