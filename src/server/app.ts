import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthCheck } from './db'
import { env } from '@/lib/env'
import { logger as appLogger } from './utils/logger'
import { AppError } from './utils/errors'

const app = new Hono().basePath('/api')

app.use('*', logger())
app.use('*', cors())

app.get('/health', async (c) => {
  const dbHealth = await healthCheck();
  const overallStatus = dbHealth.status === 'healthy' ? 'ok' : 'degraded';
  
  appLogger.info('Health check performed', {
    status: overallStatus,
    database: dbHealth.status,
  });
  
  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: env.NODE_ENV || 'development',
    checks: {
      app: 'running',
      database: {
        status: dbHealth.status,
        message: dbHealth.message,
        ...dbHealth.details,
      },
      redis: 'pending'
    }
  })
})

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    appLogger.error(err.message, err, {
      code: err.code,
      details: err.details,
      url: c.req.url,
      method: c.req.method,
    });
    
    return c.json(err.toJSON(), err.statusCode as never);
  }
  
  // Log unexpected errors
  appLogger.error('Unexpected error', err as Error, {
    url: c.req.url,
    method: c.req.method,
  });
  
  return c.json({
    code: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
  }, 500);
});

export default app