import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import stylisticJs from '@stylistic/eslint-plugin-js';

export default tseslint.config(
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-magic-numbers': [
        'error',
        {
          'ignoreArrayIndexes': true, // Ignores numbers used as array indices
          'enforceConst': true, // Enforces that numbers be declared as constants
          'detectObjects': true, // Ignores numbers in object properties
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: { constructors: 'off' },
        },
      ],
      'operator-linebreak': [
        'error',
        'before',
        { overrides: { '&&': 'before', '=': 'after' } },
      ],
      'object-curly-spacing': ['error', 'always'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
        },
      ],
    },
  },
  {
    files: ['**/constants.ts', '**/*.config.*s', '**/enums.ts'],
    // Override or add rules here
    rules: {
      'no-magic-numbers': 'off',
    },
  }
);