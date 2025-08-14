# Technical Assumptions

## Repository Structure: Single Repository
- Standard Next.js project structure with integrated Hono backend
- Hono installed as a dependency within the Next.js project
- Backend API handled through router.ts file in the Next.js app
- Shared types and utilities within the same codebase

## Service Architecture
Integrated Next.js + Hono architecture:
- Next.js serves as the main application framework
- Hono.js integrated via router.ts to handle API endpoints
- API routes served directly through Next.js server
- Stateless backend services enabling horizontal scaling
- Queue system for async operations (document processing)
- Frontend and backend deployed as a single unit

## Testing Requirements
Full Testing Pyramid approach:
- Unit tests for business logic and utilities
- Integration tests for API endpoints and database operations
- E2E tests for critical user flows (booking creation, document upload)
- Manual testing convenience methods for QA workflows
- Minimum 80% code coverage for backend services

## Additional Technical Assumptions and Requests
- **Frontend Stack:** Next.js 15 App Router, TypeScript, Shadcn UI, TanStack Query/Table/Form
- **Backend Stack:** Hono.js (via Next.js handler), Drizzle ORM, PostgreSQL 15+, Better Auth with plugins: admin, organization, 2fa, phone number, email otp
- **Infrastructure:** AWS EC2/ECS for hosting, S3 for PHI documents, RDS for PostgreSQL, no CDN for PHI
- **Security:** Portal-proxied downloads only
- **Deployment:** Docker container via AWS ECS
- **Development:** Standard Next.js project structure, ESLint/Prettier for code quality
- **Monitoring:** AWS CloudWatch for logs/metrics, Sentry for error tracking
- **API Design:** RESTful endpoints via Hono routes with consistent naming conventions
