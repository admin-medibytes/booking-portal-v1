import { describe, it, expect } from 'vitest'
import app from '../test-app'

describe('Health Check Endpoint', () => {
  it('should return 200 OK with system status', async () => {
    const res = await app.request('/api/health')
    
    expect(res.status).toBe(200)
    
    const data = await res.json()
    
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('environment')
    expect(data).toHaveProperty('checks')
    
    expect(data.checks.app).toBe('running')
    expect(data.checks.database).toHaveProperty('status', 'healthy')
    expect(data.checks.redis).toBe('pending')
  })
  
  it('should include valid timestamp', async () => {
    const res = await app.request('/api/health')
    const data = await res.json()
    
    const timestamp = new Date(data.timestamp)
    expect(timestamp.toString()).not.toBe('Invalid Date')
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
  })
})