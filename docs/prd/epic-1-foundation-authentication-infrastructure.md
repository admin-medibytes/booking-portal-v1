# Epic 1: Foundation & Authentication Infrastructure

Establish the foundational project infrastructure with Next.js 15, Hono.js integration, Better Auth implementation with all required plugins, database setup, and core architectural patterns. This epic delivers a working authentication system where invited users can log in with 2FA options and see role-appropriate landing pages, proving the technical stack works end-to-end.

## Story 1.1: Project Setup & Core Infrastructure

As a developer,  
I want to initialize the Next.js 15 project with Hono.js integration,  
so that we have a working foundation with API routing and deployment-ready structure.

### Acceptance Criteria
1. Next.js 15 project initialized with App Router and TypeScript configuration
2. Hono.js installed and router.ts configured to handle API routes through Next.js
3. Docker configuration created for containerized deployment
4. Environment variable structure established for configuration management
5. Basic health check endpoint accessible at /api/health returning system status
6. Git repository initialized with proper .gitignore for Next.js projects
7. Development server runs successfully with hot reload working

## Story 1.2: Database Setup & Schema Design

As a developer,  
I want to configure PostgreSQL with Drizzle ORM and design the initial schema,  
so that we have a type-safe database layer ready for user and booking data.

### Acceptance Criteria
1. PostgreSQL database connection established via Drizzle ORM
2. Initial schema created for users, organizations, teams, and sessions (Better Auth requirements)
3. Schema includes booking, document, and audit log table structures
4. Database migrations setup and initial migration executed successfully
5. Drizzle Studio configured for local database inspection
6. Connection pooling configured for production readiness

## Story 1.3: Better Auth Integration & Configuration

As a developer,  
I want to implement Better Auth with all required plugins,  
so that invited users can authenticate with multiple methods and proper role management.

### Acceptance Criteria
1. Better Auth core configured with PostgreSQL adapter
2. Admin plugin enabled with 'user' and 'admin' roles configured
3. Organization plugin enabled with teams enabled and roles: owner, manager, team_lead, referrer, specialist
4. 2FA plugin configured supporting authenticator apps
5. Phone number plugin integrated for SMS-based auth (provider configured)
6. Email OTP plugin configured for email-based verification
7. Session management working with secure cookies
8. Auth middleware protecting API routes based on authentication status

## Story 1.4: User Invitation & Initial Login Flow

As an admin,  
I want to invite users to the platform with pre-assigned roles,  
so that only authorized users can access the system.

### Acceptance Criteria
1. Admin API endpoint to create user accounts with email and assigned role
2. Invitation email sent with secure, time-limited activation link
3. First-time login flow allows password creation and optional 2FA setup
4. Login page supports email/password with "remember me" option
5. Phone number verification optional during first login
6. Successful login redirects to role-appropriate landing page
7. Password reset flow implemented with secure token generation
8. Expired invitation links show appropriate error message

## Story 1.5: Role-Based Landing Pages

As an authenticated user,  
I want to see a landing page with calendar and list views appropriate to my role,  
so that I can quickly access and view bookings relevant to me.

### Acceptance Criteria
1. All users land on a dashboard showing both calendar view and list view of bookings
2. Admin users additionally see referrer search option (for impersonation) in the navigation
3. Referrer users see their own bookings and have access to create new bookings
4. Specialist users see only bookings assigned to them
5. Organization owners/managers see bookings for their entire organization/teams
6. Each booking in calendar/list views has a "View Details" button linking to detail page
7. Proper navigation menu adapts based on user role
8. Logout functionality clears session and returns to login page
