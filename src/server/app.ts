import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono().basePath('/api')

app.use('*', logger())
app.use('*', cors())

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      app: 'running',
      database: 'pending',
      redis: 'pending'
    }
  })
})

export default app