// ESLint flat config — minimal, per WFLX-W1 scaffold scope.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'bun.lock', 'reference/**', 'artifacts/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Frozen contracts are written explicitly; keep `any` out of them.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
