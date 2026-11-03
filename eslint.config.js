import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'legacy', 'tests', 'supabase', 'docs', 'data'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // F-UI-1: hộp thoại luôn đi qua useDialog
      'no-alert': 'error',
      // F-UI-2: không đưa HTML thô vào trang
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Cấm dangerouslySetInnerHTML (F-UI-2).' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // bộ phân loại phải giữ NBSP và regex đúng từng byte như legacy (F-IMP-1)
    files: ['src/lib/classify/**'],
    rules: { 'no-irregular-whitespace': 'off' },
  },
);
