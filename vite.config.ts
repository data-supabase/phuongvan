import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vitest/config';
import tailwindConfig from './config/tailwind.config';

export default defineConfig({
  plugins: [react()],
  // PostCSS khai báo tại đây thay cho postcss.config.js (gọn thư mục gốc)
  css: { postcss: { plugins: [tailwindcss(tailwindConfig), autoprefixer()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // thư viện ít đổi tách riêng để trình duyệt cache lâu; xlsx đã tự tách nhờ import() động
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: { include: ['tests/react/**/*.test.ts'], environment: 'node', passWithNoTests: true },
});
