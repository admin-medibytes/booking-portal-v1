# Tech Stack

This is the DEFINITIVE technology selection for the entire project. All development must use these exact versions.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3.3 | Type-safe development language | Strong typing reduces bugs, excellent Next.js integration |
| Frontend Framework | Next.js | 15.0.0 | Full-stack React framework | App Router, RSC support, integrated API routes |
| UI Component Library | Shadcn UI | Latest | Accessible component system | Customizable, WCAG compliant, perfect for medical-legal UI |
| State Management | TanStack Query | 5.51.0 | Server state management | Caching, optimistic updates, background refetch |
| Backend Language | TypeScript | 5.3.3 | Type-safe backend development | Shared types with frontend, consistency |
| Backend Framework | Hono | 4.5.0 | Lightweight web framework | Excellent Next.js integration, type-safe, fast |
| API Style | REST | - | HTTP API protocol | Simple, well-understood, works with portal-proxy pattern |
| Database | PostgreSQL | 15.4 | Primary data store | ACID compliance, JSON support, proven reliability |
| ORM | Drizzle | 0.33.0 | Type-safe SQL | Better performance than Prisma, full TypeScript |
| Cache | Redis | 7.2 | In-memory cache | Acuity data caching, session storage |
| File Storage | AWS S3 | - | Document storage | HIPAA compliant with encryption, scalable |
| Authentication | Better Auth | Latest | Auth solution | Supports all required plugins (admin, org, 2FA, phone) |
| Validation | ArkType | 2.0.0 | Runtime validation | 100x faster than Zod, TypeScript-first syntax |
| Frontend Testing | Vitest | 2.0.0 | Unit/integration testing | Fast, ESM support, Next.js compatible |
| Backend Testing | Vitest | 2.0.0 | API testing | Same as frontend for consistency |
| E2E Testing | Playwright | 1.45.0 | Browser automation | Cross-browser, reliable, good debugging |
| Package Manager | pnpm | 9.5.0 | Dependency management | Fast, efficient disk usage |
| IaC Tool | AWS CDK | 2.150.0 | Infrastructure as Code | Type-safe infrastructure, integrates with TypeScript |
| CI/CD | GitHub Actions | - | Automation pipeline | Free for public repos, good AWS integration |
| Monitoring | AWS CloudWatch | - | Logs and metrics | Native AWS integration, works with Pino |
| Logging | Pino | 9.3.0 | Structured logging | Fast, JSON output for audit systems |
| CSS Framework | Tailwind CSS | 3.4.0 | Utility CSS | Works with Shadcn UI, fast development |
| Date Handling | date-fns | 3.6.0 | Date utilities | Tree-shakeable, timezone support |
| Forms | TanStack Form | 0.26.0 | Form state management & validation | Type-safe forms with ArkType integration, excellent TypeScript support |
| Tables | TanStack Table | 8.19.0 | Data tables | Sorting, filtering, pagination built-in |
| Environment Variables | @t3-oss/env-nextjs | 0.11.0 | Env var validation | Type-safe environment variables with runtime validation |
