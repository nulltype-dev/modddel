import nullTypeConfig from '@nulltype/eslint-config-ts-base'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['dist/*'],
  },
  ...tseslint.configs.recommended,
  ...nullTypeConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      'no-extra-semi': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
]
