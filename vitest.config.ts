import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit test (default): tanpa jaringan, cepat, aman dijalankan di CI.
 * Integration test RLS/IDOR: `npm run test:integration` (butuh .env.local + akun uji).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Paket `server-only` melempar error di luar React Server Components; di tes cukup modul kosong.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
