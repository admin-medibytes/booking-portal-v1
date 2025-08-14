# Monitoring and Observability

## Monitoring Stack
- **Frontend Monitoring:** Browser console logs + future Sentry integration
- **Backend Monitoring:** CloudWatch Logs with Pino structured logging
- **Error Tracking:** CloudWatch Logs queries for error analysis
- **Performance Monitoring:** CloudWatch Metrics for API response times

## Key Metrics

**Frontend Metrics:**
- Page load time (target: < 3s)
- Time to interactive
- API response times
- JavaScript errors

**Backend Metrics:**
- Request rate by endpoint
- Error rate by endpoint
- Response time p50/p95/p99
- Database query performance
- External API latency (Acuity)
- Queue depth (webhooks)
