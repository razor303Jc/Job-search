// Global type declarations for tests
import type { Mock } from 'vitest';

declare global {
  var fetch: Mock;
}

export {};