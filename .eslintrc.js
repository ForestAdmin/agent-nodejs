const { resolve } = require('path');
const { readdirSync } = require('fs');

module.exports = {
  env: { browser: true, es2021: true, jest: true },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:jest/recommended',
  ],
  ignorePatterns: ['.eslintrc.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    project: ['./tsconfig.eslint.json'],
  },
  plugins: ['@typescript-eslint', 'prettier', 'jest'],
  rules: {
    /**********/
    /** Style */
    /**********/

    // Code spacing
    'prettier/prettier': 'error',
    'arrow-parens': ['error', 'as-needed'],
    '@typescript-eslint/indent': 'off',
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: '*', next: 'block-like' },
      { blankLine: 'always', prev: 'block-like', next: '*' },
    ],

    // Import order
    'sort-imports': ['error', { ignoreDeclarationSort: true }],
    'import/order': [
      'error',
      {
        groups: [
          'type',
          ['builtin', 'external'],
          ['internal', 'sibling', 'parent', 'index', 'object'],
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    /***********************************/
    /* Stricter rules than airbnb-base */
    /***********************************/

    // No unused variables
    '@typescript-eslint/no-unused-vars': ['error'],

    // No reassigning function parameters
    'no-param-reassign': ['error', { props: false }],

    /**************************************/
    /* Less strict rules than airbnb-base */
    /**************************************/

    // Allow `function (arg1, arg2) { void arg1; void arg2; }` to work around unused arguments
    'no-void': ['error', { allowAsStatement: true }],

    // Allow methods that do not use `this` (notably private methods)
    'class-methods-use-this': 'off',

    // Allow imports/exports to go over the max line length
    'max-len': ['error', { code: 100, ignorePattern: '^(import|export) .*' }],

    // Allow for-of loops
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],

    // Allow properties in classes to not have emptry lines between them
    '@typescript-eslint/lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true },
    ],

    // Allow using the console for logging warning, errors, etc.
    'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],

    // Allow `this._id`, `this._name`, etc... (probably for MongoDB)
    'no-underscore-dangle': ['error', { allowAfterThis: true }],

    // Consistent return is enforced by typescript. Leaving this on causes double errors.
    'consistent-return': 'off',

    // We allow import cycles because they cause no issues for types.
    'import/no-cycle': 'off',
  },
  overrides: [
    ...readdirSync(resolve(__dirname, 'packages'))
      .filter(pkg => pkg.substring(0, 1) !== '.')
      .map(pkg => ({
        // Per-package configuration
        files: [`packages/${pkg}/**/*`],
        rules: {
          // Allow using dependencies from both the root package.json and the package's package.json
          // + only tests can import devDependencies
          'import/no-extraneous-dependencies': [
            'error',
            {
              packageDir: [__dirname, resolve(__dirname, 'packages', pkg)],
              devDependencies: ['**/test/**/*.ts'],
            },
          ],
        },
      })),
  ],
};
