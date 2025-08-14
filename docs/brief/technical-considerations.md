# Technical Considerations

## Platform Requirements

- **Target Platforms:** Modern web browsers (Chrome, Firefox, Safari, Edge) with responsive design for desktop and mobile devices
- **Browser/OS Support:** Latest two versions of major browsers, iOS 14+ and Android 10+ for mobile web access
- **Performance Requirements:** 
  - Page load under 2 seconds on 4G mobile connections
  - Support 100+ concurrent users without degradation
  - File uploads up to 100MB for medical documents
  - Real-time calendar updates without page refresh

## Technology Preferences

- **Frontend:** Next.js 14+ with App Router, TypeScript for type safety, Shadcn UI for consistent component library, TanStack Query for data fetching and caching, TanStack Table for data grids, TanStack Form for form management
- **Backend:** Hono.js for lightweight API server, Drizzle ORM for type-safe database queries, PostgreSQL for relational data storage, Better Auth with admin & organization plugins, Pino for structured logging and audit trails
- **Database:** PostgreSQL 15+ for ACID compliance and complex queries, structured schema for bookings, users, organizations, and documents, optimized indexes for common query patterns
- **Hosting/Infrastructure:** 
  - AWS EC2 for application hosting
  - AWS ECS or EKS for container orchestration
  - AWS S3 for secure document storage (PHI documents)
  - AWS RDS for PostgreSQL database
  - AWS Application Load Balancer for load balancing and SSL termination
  - AWS CloudFront for static assets only (NO PHI documents in CDN)

## Architecture Considerations

- **Repository Structure:** Single repository with clear separation between frontend and backend code, shared types and utilities in common packages
- **Service Architecture:** API-first design with clear REST endpoints, stateless backend services for horizontal scaling, queue system for async operations (document processing), webhook infrastructure for future integrations
- **Integration Requirements:** Acuity Scheduling API for calendar management, AWS S3 SDK for document operations, Resend API for transactional emails, Future: Legal case management systems APIs
- **Security/Compliance:** 
  - HIPAA-compliant and Privacy Act 1988/Australian Privacy Principles (APPs) compliant infrastructure
  - Encryption at rest and in transit for all PHI data
  - Portal-proxied document downloads with access validation (no CDN caching for PHI)
  - Comprehensive audit trails for PHI access using Pino logging
  - Regular security scanning and penetration testing
  - SOC 2 Type II compliance roadmap
  - Zero-trust security model with principle of least privilege
