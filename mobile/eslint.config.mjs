import js from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['coverage/**', 'dist/**', 'node_modules/**']),
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: {
      react: eslintPluginReact,
      import: eslintPluginImport,
      'simple-import-sort': eslintPluginSimpleImportSort,
      'react-hooks': reactHooks
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaVersion: 2022,
        ecmaFeatures: { jsx: true },
        sourceType: 'module'
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-else-return': 'error',
      'no-multi-spaces': 'error',
      'no-whitespace-before-property': 'error',
      'new-cap': 'off',
      'no-console': 'error',
      'comma-dangle': ['error', 'never'],
      'no-shadow': 'off',
      'object-shorthand': ['error', 'properties'],
      'import/prefer-default-export': 'off',
      'lines-between-class-members': 'off',
      'import/no-unresolved': 'off',
      'no-underscore-dangle': 'off',
      'react/react-in-jsx-scope': 'off',
      'class-methods-use-this': 'off',
      'arrow-body-style': 'off',
      'import/no-cycle': 'off',
      'no-useless-escape': 'off',
      'no-unused-vars': [
        'error',
        { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'react-hooks/exhaustive-deps': 'off',
      'react/jsx-no-undef': ['error', { allowGlobals: true }],
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-first-prop-new-line': ['error', 'multiline'],
      'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/jsx-indent': ['error', 2],
      'react/jsx-indent-props': ['error', 2],
      'react/jsx-boolean-value': ['error', 'never'],
      'no-dupe-keys': 'error',
      'no-constant-binary-expression': 'off',
      'no-constant-condition': 'off',
      'import/no-duplicates': 'error',
      'object-curly-spacing': ['error', 'always'],
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-undef': 'error',
      'jsx-quotes': ['error', 'prefer-double'],
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'padding-line-between-statements': ['error', { blankLine: 'never', prev: 'import', next: 'import' }],
      'arrow-parens': ['error', 'always'],
      'max-statements-per-line': ['error', { max: 1 }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportNamedDeclaration[declaration!=null]',
          message: 'Inline named exports are disallowed in JS/JSX. Declare first, then export in a separate statement.'
        }
      ],
      'simple-import-sort/exports': 'error',
      'import/group-exports': 'error',
      'import/exports-last': 'error'
    }
  },
  {
    files: ['jest.setup.js', '__mocks__/**/*.js', 'src/**/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    rules: {
      'import/exports-last': 'off',
      'import/group-exports': 'off',
      'no-restricted-syntax': 'off',
      'no-unused-vars': 'off'
    }
  },
  eslintPluginPrettierRecommended,
  {
    rules: {
      curly: ['error', 'all']
    }
  }
]);
