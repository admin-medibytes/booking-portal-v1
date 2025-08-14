# Security and Performance

## Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';`
- XSS Prevention: React's built-in escaping + sanitization for user content
- Secure Storage: HTTPOnly cookies for auth tokens, no localStorage for sensitive data

**Backend Security:**
- Input Validation: ArkType validation on all endpoints
- Rate Limiting: 100 requests per minute per IP
- CORS Policy: Restricted to frontend domain only

**Authentication Security:**
- Token Storage: Secure HTTPOnly cookies with SameSite=Strict
- Session Management: 24-hour sessions with refresh
- Password Policy: Minimum 8 characters, complexity requirements

## Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 200KB initial JS
- Loading Strategy: Route-based code splitting, lazy loading for heavy components
- Caching Strategy: 
  - Static assets: 1 year cache
  - API responses: 30 second SWR
  - Specialist availability: 5 minute cache

**Backend Performance:**
- Response Time Target: < 200ms for list views, < 100ms for details
- Database Optimization:
  - Connection pooling (10 connections)
  - Prepared statements
  - Covering indexes for common queries
- Caching Strategy:
  - Redis for session storage
  - Acuity availability cached 5 minutes
  - Appointment types cached 1 hour
