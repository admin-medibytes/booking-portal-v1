import { describe, it, expect, vi } from 'vitest';
import { testDatabaseConnection } from '@/server/db';

// Mock the environment
vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DB_SSL: 'false',
    DB_POOL_SIZE: '10',
  }
}));

describe('Database Health Check', () => {
  it('should export testDatabaseConnection function', () => {
    expect(testDatabaseConnection).toBeDefined();
    expect(typeof testDatabaseConnection).toBe('function');
  });
});