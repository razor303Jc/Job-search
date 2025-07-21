// Global test setup for Vitest
import { afterAll, beforeAll } from 'vitest';

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
});

afterAll(async () => {
  // Cleanup after tests
});
