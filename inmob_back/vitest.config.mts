import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        testTimeout: 30000,
        hookTimeout: 120000,
        // Run test files sequentially: stable mongodb-memory-server + mongoose singleton
        fileParallelism: false,
    },
});
