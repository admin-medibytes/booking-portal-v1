import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthCheck } from './test-db';
import { env } from '@/lib/env';
import { logger as appLogger } from '@/server/utils/logger';

const testApp = new Hono().basePath('/api');

testApp.use('*', logger());
testApp.use('*', cors());

testApp.get('/health', async (c) => {
  const dbHealth = await healthCheck();
  const overallStatus = dbHealth.status === 'healthy' ? 'ok' : 'degraded';
  
  appLogger.info('Health check performed', {
    status: overallStatus,
    database: dbHealth.status,
  });
  
  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
    checks: {
      app: 'running',
      database: {
        status: dbHealth.status,
        message: dbHealth.message,
        ...(dbHealth.details && { details: dbHealth.details }),
      },
      redis: 'pending', // Redis check not implemented yet
    },
  });
});

export default testApp;