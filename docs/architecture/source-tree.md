# Unified Project Structure

```plaintext
medibytes-booking/
├── .github/                          # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml                   # Test and lint on PR
│       └── deploy.yaml               # Deploy to AWS ECS
├── src/                              # Source code directory
│   ├── app/                          # Next.js app directory
│   │   ├── (auth)/                   # Auth layout group
│   │   │   ├── layout.tsx            # Minimal auth layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Login page
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx          # Password reset
│   │   │   └── verify/
│   │   │       └── page.tsx          # Email/phone verification
│   │   ├── (dashboard)/              # Main app layout group
│   │   │   ├── layout.tsx            # Dashboard shell with nav
│   │   │   ├── page.tsx              # Redirect to /bookings
│   │   │   ├── bookings/
│   │   │   │   ├── page.tsx          # Calendar/list view
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # Booking detail
│   │   │   │   └── new/
│   │   │   │       └── page.tsx      # Create booking wizard
│   │   │   ├── documents/
│   │   │   │   └── page.tsx          # Document management
│   │   │   └── settings/
│   │   │       ├── page.tsx          # User settings
│   │   │       └── organization/
│   │   │           └── page.tsx      # Org settings
│   │   ├── admin/                    # Admin-only routes
│   │   │   ├── layout.tsx            # Admin layout
│   │   │   ├── impersonate/
│   │   │   │   └── page.tsx          # Referrer search
│   │   │   └── audit/
│   │   │       └── page.tsx          # Audit logs
│   │   ├── api/                      # API routes
│   │   │   └── [[...route]]/
│   │   │       └── route.ts          # Hono app handler
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing/redirect
│   │   └── providers.tsx             # Client providers
│   ├── components/                   # React components
│   │   ├── ui/                       # Shadcn UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...                   # Other UI components
│   │   ├── bookings/                 # Booking components
│   │   │   ├── booking-card.tsx
│   │   │   ├── booking-calendar.tsx
│   │   │   ├── booking-list.tsx
│   │   │   ├── booking-filters.tsx
│   │   │   └── specialist-select.tsx
│   │   ├── documents/                # Document components
│   │   │   ├── document-upload.tsx
│   │   │   ├── document-list.tsx
│   │   │   └── document-viewer.tsx
│   │   ├── forms/                    # Form components
│   │   │   ├── booking-form.tsx
│   │   │   ├── examinee-form.tsx
│   │   │   └── progress-form.tsx
│   │   └── layout/                   # Layout components
│   │       ├── dashboard-nav.tsx
│   │       ├── user-menu.tsx
│   │       ├── impersonation-banner.tsx
│   │       └── mobile-nav.tsx
│   ├── server/                       # Backend code
│   │   ├── routes/                   # API route handlers
│   │   │   ├── auth.routes.ts
│   │   │   ├── bookings.routes.ts
│   │   │   ├── documents.routes.ts
│   │   │   ├── specialists.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   └── webhooks.routes.ts
│   │   ├── services/                 # Business logic
│   │   │   ├── booking.service.ts
│   │   │   ├── document.service.ts
│   │   │   ├── acuity.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── audit.service.ts
│   │   ├── repositories/             # Data access
│   │   │   ├── booking.repository.ts
│   │   │   ├── document.repository.ts
│   │   │   └── specialist.repository.ts
│   │   ├── middleware/               # Hono middleware
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   ├── audit.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── db/                       # Database
│   │   │   ├── schema.ts             # Drizzle schema
│   │   │   └── migrations/           # SQL migrations
│   │   └── app.ts                    # Hono app setup
│   ├── lib/                          # Shared utilities
│   │   ├── auth.ts                   # Better Auth setup
│   │   ├── db.ts                     # Drizzle client
│   │   ├── redis.ts                  # Redis client
│   │   ├── s3.ts                     # S3 client
│   │   ├── api-client.ts             # Frontend API client
│   │   ├── utils.ts                  # Shared utilities
│   │   └── constants.ts              # App constants
│   ├── hooks/                        # React hooks
│   │   ├── use-bookings.ts
│   │   ├── use-specialists.ts
│   │   └── use-impersonation.ts
│   ├── types/                        # TypeScript types
│   │   ├── booking.ts
│   │   ├── document.ts
│   │   ├── user.ts
│   │   └── api.ts
│   └── styles/                       # Global styles
│       └── globals.css               # Tailwind imports
├── public/                           # Static assets
│   ├── favicon.ico
│   └── images/
├── scripts/                          # Build/deploy scripts
│   ├── db-migrate.ts                 # Run migrations
│   ├── db-seed.ts                    # Seed data
│   └── generate-types.ts             # Type generation
├── tests/                            # Test files
│   ├── unit/                         # Unit tests
│   │   ├── services/
│   │   └── components/
│   ├── integration/                  # Integration tests
│   │   └── api/
│   └── e2e/                          # E2E tests
│       └── booking-flow.spec.ts
├── infrastructure/                   # IaC definitions
│   ├── lib/                          # CDK code
│   │   ├── ecs-stack.ts              # Container service
│   │   ├── rds-stack.ts              # Database
│   │   └── s3-stack.ts               # Storage
│   ├── bin/
│   │   └── infrastructure.ts         # CDK app
│   └── cdk.json                      # CDK config
├── .env.example                      # Environment template
├── .eslintrc.json                    # ESLint config
├── .prettierrc                       # Prettier config
├── docker-compose.yml                # Local development
├── Dockerfile                        # Production image
├── drizzle.config.ts                 # Drizzle config
├── next.config.js                    # Next.js config
├── package.json                      # Dependencies
├── pnpm-lock.yaml                    # Lock file
├── tailwind.config.ts                # Tailwind config
├── tsconfig.json                     # TypeScript config
├── vitest.config.ts                  # Test config
└── README.md                         # Project docs
```
