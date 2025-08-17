import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthCheck } from './db'
import { env } from '@/lib/env'
import { logger as appLogger } from './utils/logger'
import { AppError } from './utils/errors'
import authRoutes from './routes/auth.routes'
import adminRoutes from './routes/admin.routes'
import publicRoutes from './routes/public.routes'
import userRoutes from './routes/user.routes'
import { bookingsRoutes } from './routes/bookings.routes'
import { specialistsRoutes } from './routes/specialists.routes'

const app = new Hono().basePath('/api')

app.use('*', logger())
app.use('*', cors())

// Mount public routes (no auth required)
app.route('/public', publicRoutes)

// Mount auth routes
app.route('/auth', authRoutes)

// Mount admin routes
app.route('/admin', adminRoutes)

// Mount user routes (authenticated)
app.route('/user', userRoutes)

// Mount bookings routes (authenticated)
app.route('/bookings', bookingsRoutes)

// Mount specialists routes (authenticated)
app.route('/specialists', specialistsRoutes)

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