import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import DemoSafeSequencer from './tests/sequencer.mts';

export default defineConfig({
  // Lets unit tests import app code that uses the '@/...' path alias.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['db/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    // DB tests share one database; run files one at a time, pristine-seed tests before mutating ones.
    fileParallelism: false,
    sequence: { sequencer: DemoSafeSequencer },
    // After a run that changed data (ALLOW_MUTATING_TESTS=1) the demo is restored automatically.
    globalSetup: ['tests/globalSetup.ts'],
  },
});
