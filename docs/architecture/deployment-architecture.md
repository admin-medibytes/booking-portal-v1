# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**
- **Platform:** AWS ECS with Fargate
- **Build Command:** `pnpm build`
- **Output Directory:** `.next` (handled by Next.js)
- **CDN/Edge:** CloudFront for static assets

**Backend Deployment:**
- **Platform:** Same ECS container as frontend
- **Build Command:** Included in `pnpm build`
- **Deployment Method:** Docker container with Node.js

## CI/CD Pipeline
```yaml