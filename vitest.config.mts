import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/__tests__/**/*.test.ts', 'tests/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    server: {
      deps: {
        // @qualweb/coreのESM解決問題を回避
        fallbackCJS: true,
      },
    },
  },
  // Vite設定でCJS互換性を有効化
  resolve: {
    conditions: ['node', 'require'],
  },
  // 最適化対象から除外
  optimizeDeps: {
    exclude: ['@qualweb/core'],
  },
});
