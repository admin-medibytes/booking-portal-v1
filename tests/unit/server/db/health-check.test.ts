import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testDatabaseConnection, healthCheck, initializeDatabaseConnection, closeDatabaseConnection } from '@/server/db';
import type { DatabaseHealthCheck } from '@/server/db';

// Mock the postgres client
const mockClient = {
  end: vi.fn().mockResolvedValue(undefined),
};

// Mock the query execution
const mockQuery = vi.fn();
Object.setPrototypeOf(mockQuery, mockClient);

// Mock postgres module
vi.mock('postgres', () => ({
  default: vi.fn(() => mockQuery),
}));

// Mock the environment
vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DB_SSL: 'false',
    DB_POOL_SIZE: '10',
  }
}));

// Mock the logger
vi.mock('@/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    dbConnection: vi.fn(),
    dbError: vi.fn(),
  }
}));

describe('Database Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('testDatabaseConnection', () => {
    it('should return true when connection is successful', async () => {
      mockQuery.mockResolvedValueOnce([{ '?column?': 1 }]);
      
      const result = await testDatabaseConnection();
      
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should return false when connection fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await testDatabaseConnection();
      
      expect(result).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith(['SELECT 1']);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      mockQuery.mockResolvedValueOnce([{ now: new Date() }]);
      
      const result = await healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Database connection is healthy');
      expect(result.details?.poolSize).toBe(10);
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when database is not accessible', async () => {
      const error = new Error('Database unreachable');
      mockQuery.mockRejectedValueOnce(error);
      
      const result = await healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Database connection failed');
      expect(result.message).toContain(error.message);
    });
  });

  describe('initializeDatabaseConnection', () => {
    it('should successfully initialize connection on first attempt', async () => {
      mockQuery.mockResolvedValue([{ '?column?': 1 }]);
      
      await expect(initializeDatabaseConnection()).resolves.toBeUndefined();
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockQuery
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce([{ '?column?': 1 }]);
      
      await expect(initializeDatabaseConnection()).resolves.toBeUndefined();
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should throw DatabaseError after max retries', async () => {
      mockQuery.mockRejectedValue(new Error('Connection failed'));
      
      await expect(initializeDatabaseConnection()).rejects.toThrow('Failed to establish database connection after 3 attempts');
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should implement exponential backoff with jitter', async () => {
      const startTime = Date.now();
      mockQuery
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockRejectedValueOnce(new Error('Second attempt'))
        .mockResolvedValueOnce([{ '?column?': 1 }]);
      
      await initializeDatabaseConnection();
      
      const elapsedTime = Date.now() - startTime;
      // Should take at least 3 seconds (1s + 2s delays) but less than 10s
      expect(elapsedTime).toBeGreaterThan(2000);
      expect(elapsedTime).toBeLessThan(10000);
    });
  });

  describe('closeDatabaseConnection', () => {
    it('should successfully close the connection', async () => {
      await expect(closeDatabaseConnection()).resolves.toBeUndefined();
      expect(mockClient.end).toHaveBeenCalledTimes(1);
    });

    it('should throw error when close fails', async () => {
      const error = new Error('Failed to close connection');
      mockClient.end.mockRejectedValueOnce(error);
      
      await expect(closeDatabaseConnection()).rejects.toThrow(error);
      expect(mockClient.end).toHaveBeenCalledTimes(1);
    });
  });
});