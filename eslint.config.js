const nx = require('@nx/eslint-plugin');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', 'libs/prisma/.generated'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/workspace-ts-pattern-require-exhaustive': 'error',
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
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/constants.ts', '**/eslint.config.js', '**/enums.ts'],
    // Override or add rules here
    rules: {
      'no-magic-numbers': 'off',
    },
  },
];
