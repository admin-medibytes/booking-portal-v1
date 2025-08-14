# Medical Examination Booking Platform Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for Medical Examination Booking Platform, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Project Context

The Medical Examination Booking Platform addresses critical inefficiencies in Australia's personal injury legal system, where law firms must coordinate Independent Medical Examinations (IMEs) through intermediary services. Currently handling ~90 bookings monthly across 50+ referrers, the manual phone-based process wastes approximately 27 hours of staff time on coordination alone.

This architecture delivers a secure, HIPAA and Privacy Act 1988/APPs compliant platform that:
- Enables sub-3-minute self-service booking creation
- Provides real-time visibility across all stakeholders
- Maintains comprehensive audit trails for legal compliance
- Supports 150+ bookings/month without additional staff
- Integrates with existing Acuity Scheduling infrastructure

### Architectural Philosophy

Given the medical-legal context and compliance requirements, this architecture prioritizes:
- **Security First**: All PHI data encrypted in transit and at rest, portal-proxied document access
- **Audit Everything**: Comprehensive logging with Pino for external audit system integration
- **Role-Based Access**: Granular permissions using Better Auth with organization/team plugins
- **Scalable Foundation**: Stateless services enabling horizontal scaling as volume grows
- **Developer Experience**: Type-safe end-to-end with TypeScript, ArkType validation, and Drizzle ORM

### Starter Template or Existing Project

N/A - Greenfield project

While starter templates like T3 Stack or Vercel's Next.js templates were considered, the specific requirements drove a custom approach:
- Better Auth with extensive plugin requirements (admin, organization with teams, 2FA, phone, email OTP)
- Hono.js integration within Next.js for API routes (non-standard setup)
- Strict medical document handling with portal-proxy pattern
- Complex role hierarchy with impersonation capabilities

Starting fresh ensures clean implementation of these domain-specific requirements without fighting framework assumptions.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-13 | 1.0 | Initial fullstack architecture document | Winston (Architect) |

## High Level Architecture

### Technical Summary

The Medical Examination Booking Platform employs a modern fullstack architecture using Next.js 15 with integrated Hono.js API routes, deployed on AWS infrastructure. The frontend leverages React Server Components and Shadcn UI for a responsive, accessible interface, while the backend uses Drizzle ORM with PostgreSQL for type-safe data access. Key integration points include Better Auth for comprehensive authentication/authorization, Acuity Scheduling for calendar management, and AWS S3 with portal-proxy pattern for secure document storage. This architecture achieves PRD goals by enabling sub-3-minute booking creation, maintaining HIPAA compliance through encrypted PHI handling, and supporting horizontal scaling to handle 150+ monthly bookings without additional administrative overhead.

### Platform and Infrastructure Choice

**Platform:** AWS (Amazon Web Services)  
**Key Services:** EC2/ECS (container hosting), RDS PostgreSQL (database), S3 (document storage), CloudWatch (monitoring), Route 53 (DNS), ALB (load balancing)  
**Deployment Regions:** ap-southeast-2 (Sydney, Australia) - single region deployment for data residency compliance

### Repository Structure

**Structure:** Standard Next.js project repository  
**Package Manager:** pnpm (for efficient dependency management)  
**Project Organization:** 
- Single repository containing Next.js app with Hono API routes via `app/api/[[...route]]/route.ts`
- Shared types and utilities within the same codebase
- Simplified deployment as a single unit

### High Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Access"
        U1[Referrer Browser]
        U2[Admin Browser]
        U3[Specialist Browser]
    end
    
    subgraph "AWS Sydney Region (ap-southeast-2)"
        subgraph "Application Layer"
            ALB[Application Load Balancer]
            EC1[ECS Container 1<br/>Next.js + Hono]
            EC2[ECS Container 2<br/>Next.js + Hono]
        end
        
        subgraph "Data Layer"
            RDS[(PostgreSQL<br/>RDS)]
            S3[S3 Bucket<br/>PHI Documents]
            CACHE[ElastiCache<br/>Redis]
        end
        
        subgraph "External Services"
            ACUITY[Acuity Scheduling API]
            SMS[SMS Provider<br/>for 2FA]
            EMAIL[Email Service<br/>SES]
        end
    end
    
    subgraph "Monitoring"
        CW[CloudWatch<br/>Logs & Metrics]
        AUDIT[External Audit<br/>System]
    end
    
    U1 --> ALB
    U2 --> ALB
    U3 --> ALB
    
    ALB --> EC1
    ALB --> EC2
    
    EC1 --> RDS
    EC2 --> RDS
    EC1 --> S3
    EC2 --> S3
    EC1 --> CACHE
    EC2 --> CACHE
    
    EC1 --> ACUITY
    EC2 --> ACUITY
    EC1 --> SMS
    EC2 --> SMS
    EC1 --> EMAIL
    EC2 --> EMAIL
    
    EC1 --> CW
    EC2 --> CW
    CW --> AUDIT
    
    style S3 fill:#ff9999
    style RDS fill:#99ccff
```

### Architectural Patterns

- **Next.js Full-Stack Architecture:** Unified application serving both frontend pages and API routes through Hono integration - _Rationale:_ Simplifies deployment and maintains type safety between frontend and backend in a single codebase
- **Repository Pattern:** Abstract database operations behind repository interfaces - _Rationale:_ Enables testing with mocks and potential future database migrations without changing business logic
- **Portal-Proxy Pattern:** All document access flows through application layer, never direct S3 URLs - _Rationale:_ Ensures every PHI document access is authenticated, authorized, and audited for compliance
- **Command Query Responsibility Segregation (CQRS) Lite:** Separate read models (list views) from write models (booking creation) - _Rationale:_ Optimizes performance for high-read scenarios like calendar views while maintaining consistency
- **Event-Driven Audit Trail:** All state changes emit events captured by Pino logger - _Rationale:_ Creates immutable audit log for compliance without impacting transaction performance
- **Backend for Frontend (BFF):** Hono API routes tailored specifically for Next.js frontend needs - _Rationale:_ Reduces over-fetching and enables optimal data shaping for UI components
- **Dependency Injection:** Use of Better Auth plugins and Drizzle repositories with clear interfaces - _Rationale:_ Improves testability and allows swapping implementations (e.g., Acuity could be replaced)
- **Optimistic UI Updates:** Frontend immediately reflects user actions while backend processes - _Rationale:_ Provides responsive feel essential for sub-3-minute booking goal

## Tech Stack

This is the DEFINITIVE technology selection for the entire project. All development must use these exact versions.

### Technology Stack Table

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

## Data Models

### Specialist
**Purpose:** Medical specialists who conduct examinations, linked to Acuity calendars and Better Auth users

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- userId: string - Link to Better Auth user account
- acuityCalendarId: string - Acuity calendar identifier
- name: string - Professional name
- specialty: string - Medical specialty
- location: string | null - Practice location (null for telehealth-only specialists)
- isActive: boolean - Availability status

### TypeScript Interface
```typescript
interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  specialty: string;
  location: string | null;
  isActive: boolean;
}
```

### Relationships
- References Better Auth user via userId
- Has many bookings

### Booking
**Purpose:** Core entity representing an IME appointment with all related information

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- acuityAppointmentId: string - Acuity appointment ID (required)
- specialistId: string - Assigned specialist
- organizationId: string - Requesting organization (from Better Auth)
- teamId: string | null - Requesting team (from Better Auth)
- createdById: string - User who created booking (from Better Auth)
- createdForId: string | null - User on whose behalf (impersonation)
- examineeName: string - Patient/examinee name
- examineePhone: string - Contact phone
- examineeEmail: string | null - Contact email
- appointmentDate: timestamp - Examination date/time
- appointmentType: 'in_person' | 'telehealth' - Appointment type
- meetingLink: string | null - Google Meet link for telehealth
- status: 'active' | 'closed' | 'archived' - High-level status
- currentProgress: 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 'generating_report' | 'report_generated' | 'payment_received' - Current progress stage
- source: 'portal' | 'acuity_direct' - Where booking originated
- externalCreatedBy: string | null - Who created in Acuity
- notes: text | null - Internal notes
- createdAt: timestamp - Booking creation time
- updatedAt: timestamp - Last modification

### TypeScript Interface
```typescript
interface Booking {
  id: string;
  acuityAppointmentId: string;
  specialistId: string;
  organizationId: string;
  teamId: string | null;
  createdById: string;
  createdForId: string | null;
  examineeName: string;
  examineePhone: string;
  examineeEmail: string | null;
  appointmentDate: Date;
  appointmentType: 'in_person' | 'telehealth';
  meetingLink: string | null;
  status: 'active' | 'closed' | 'archived';
  currentProgress: 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 
                  'generating_report' | 'report_generated' | 'payment_received';
  source: 'portal' | 'acuity_direct';
  externalCreatedBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Relationships
- Belongs to one specialist
- References Better Auth organization via organizationId
- References Better Auth team via teamId (optional)
- References Better Auth users via createdById and createdForId
- Has many documents
- Has many booking progress entries
- Has many audit logs

### BookingProgress
**Purpose:** Tracks the history of progress changes for a booking with full attribution

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- bookingId: string - Associated booking
- progress: 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 'generating_report' | 'report_generated' | 'payment_received' - Progress stage
- changedById: string - User who made the change (from Better Auth)
- changedForId: string | null - If change was made via impersonation
- notes: text | null - Optional notes about the progress change
- createdAt: timestamp - When the progress change occurred

### TypeScript Interface
```typescript
interface BookingProgress {
  id: string;
  bookingId: string;
  progress: 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 
           'generating_report' | 'report_generated' | 'payment_received';
  changedById: string;
  changedForId: string | null;
  notes: string | null;
  createdAt: Date;
}
```

### Relationships
- Belongs to one booking
- References Better Auth user via changedById
- References Better Auth user via changedForId (for impersonation)

### Document
**Purpose:** Files associated with bookings including consent forms, reports, and dictations

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- bookingId: string - Associated booking
- uploadedById: string - User who uploaded (from Better Auth)
- s3Key: string - S3 object key
- fileName: string - Original filename
- fileSize: number - Size in bytes
- mimeType: string - File MIME type
- category: 'consent_form' | 'brief' | 'report' | 'dictation' | 'other' - Document type
- createdAt: timestamp - Upload time

### TypeScript Interface
```typescript
interface Document {
  id: string;
  bookingId: string;
  uploadedById: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'consent_form' | 'brief' | 'report' | 'dictation' | 'other';
  createdAt: Date;
}
```

### Relationships
- Belongs to one booking
- References Better Auth user via uploadedById
- Referenced in audit logs

### AuditLog
**Purpose:** Immutable record of all system actions for compliance requirements

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- userId: string - Acting user (from Better Auth)
- impersonatedUserId: string | null - If action was impersonated (from Better Auth)
- action: string - Action performed
- resourceType: string - Type of resource affected
- resourceId: string - ID of affected resource
- metadata: json - Additional context
- ipAddress: string - Client IP
- userAgent: string - Client user agent
- timestamp: timestamp - When action occurred

### TypeScript Interface
```typescript
interface AuditLog {
  id: string;
  userId: string;
  impersonatedUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

### Relationships
- References Better Auth users via userId and impersonatedUserId
- References various resource types (polymorphic)

## API Specification

Based on the REST API style chosen in Tech Stack, here's the OpenAPI 3.0 specification for the Medical Examination Booking Platform:

### REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Medical Examination Booking Platform API
  version: 1.0.0
  description: API for managing IME bookings, documents, and related operations
servers:
  - url: https://api.medicalexambooking.com.au
    description: Production server
  - url: http://localhost:3000/api
    description: Development server

security:
  - bearerAuth: []

paths:
  /auth/login:
    post:
      tags: [Authentication]
      summary: Login with email and password
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
      responses:
        200:
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string

  /bookings:
    get:
      tags: [Bookings]
      summary: List bookings with filtering
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, closed, archived]
        - name: specialistIds
          in: query
          schema:
            type: array
            items:
              type: string
        - name: search
          in: query
          schema:
            type: string
          description: Search by examinee name
        - name: startDate
          in: query
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          schema:
            type: string
            format: date
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        200:
          description: Bookings list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Booking'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      tags: [Bookings]
      summary: Create new booking
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [specialistId, appointmentDateTime, examineeName, examineePhone]
              properties:
                specialistId:
                  type: string
                appointmentDateTime:
                  type: string
                  format: date-time
                examineeName:
                  type: string
                examineePhone:
                  type: string
                examineeEmail:
                  type: string
                  format: email
                notes:
                  type: string
      responses:
        201:
          description: Booking created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Booking'

  /bookings/{bookingId}:
    get:
      tags: [Bookings]
      summary: Get booking details
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Booking details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingDetails'

    patch:
      tags: [Bookings]
      summary: Update booking
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  enum: [active, closed, archived]
                notes:
                  type: string
      responses:
        200:
          description: Booking updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Booking'

  /bookings/{bookingId}/progress:
    post:
      tags: [Bookings]
      summary: Update booking progress
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [progress]
              properties:
                progress:
                  type: string
                  enum: [scheduled, rescheduled, cancelled, no_show, generating_report, report_generated, payment_received]
                notes:
                  type: string
      responses:
        201:
          description: Progress updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingProgress'

  /bookings/{bookingId}/documents:
    get:
      tags: [Documents]
      summary: List booking documents
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
        - name: category
          in: query
          schema:
            type: string
            enum: [consent_form, brief, report, dictation, other]
      responses:
        200:
          description: Documents list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Document'

    post:
      tags: [Documents]
      summary: Upload document
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file, category]
              properties:
                file:
                  type: string
                  format: binary
                category:
                  type: string
                  enum: [consent_form, brief, report, dictation, other]
      responses:
        201:
          description: Document uploaded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Document'

  /documents/{documentId}:
    get:
      tags: [Documents]
      summary: Download document (portal-proxied)
      parameters:
        - name: documentId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Document file
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary

    delete:
      tags: [Documents]
      summary: Delete document
      parameters:
        - name: documentId
          in: path
          required: true
          schema:
            type: string
      responses:
        204:
          description: Document deleted

  /specialists:
    get:
      tags: [Specialists]
      summary: List available specialists
      parameters:
        - name: isActive
          in: query
          schema:
            type: boolean
            default: true
      responses:
        200:
          description: Specialists list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Specialist'

  /specialists/{specialistId}/availability:
    get:
      tags: [Specialists]
      summary: Get specialist availability from Acuity
      parameters:
        - name: specialistId
          in: path
          required: true
          schema:
            type: string
        - name: startDate
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          required: true
          schema:
            type: string
            format: date
      responses:
        200:
          description: Available time slots
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    datetime:
                      type: string
                      format: date-time
                    duration:
                      type: integer
                      description: Duration in minutes

  /admin/impersonate:
    post:
      tags: [Admin]
      summary: Start impersonating a user
      parameters:
        - name: X-Admin-Token
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [userId]
              properties:
                userId:
                  type: string
      responses:
        200:
          description: Impersonation started
          content:
            application/json:
              schema:
                type: object
                properties:
                  impersonationToken:
                    type: string
                  user:
                    $ref: '#/components/schemas/User'

  /admin/referrers/search:
    get:
      tags: [Admin]
      summary: Search for referrers
      parameters:
        - name: query
          in: query
          required: true
          schema:
            type: string
        - name: X-Admin-Token
          in: header
          required: true
          schema:
            type: string
      responses:
        200:
          description: Search results
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

  /webhooks/acuity:
    post:
      tags: [Webhooks]
      summary: Receive Acuity webhook events
      security: []
      parameters:
        - name: X-Acuity-Signature
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: string
                id:
                  type: string
                calendarID:
                  type: string
                datetime:
                  type: string
      responses:
        200:
          description: Webhook processed

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        role:
          type: string
          enum: [admin, user]
        organization:
          $ref: '#/components/schemas/Organization'

    Organization:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string

    Specialist:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        specialty:
          type: string
        location:
          type: string
          nullable: true
        isActive:
          type: boolean

    Booking:
      type: object
      properties:
        id:
          type: string
        acuityAppointmentId:
          type: string
        specialist:
          $ref: '#/components/schemas/Specialist'
        examineeName:
          type: string
        appointmentDate:
          type: string
          format: date-time
        status:
          type: string
          enum: [active, closed, archived]
        currentProgress:
          type: string
        appointmentType:
          type: string
          enum: [in_person, telehealth]
        meetingLink:
          type: string
          nullable: true

    BookingDetails:
      allOf:
        - $ref: '#/components/schemas/Booking'
        - type: object
          properties:
            progress:
              type: array
              items:
                $ref: '#/components/schemas/BookingProgress'
            documents:
              type: array
              items:
                $ref: '#/components/schemas/Document'

    BookingProgress:
      type: object
      properties:
        id:
          type: string
        progress:
          type: string
        changedBy:
          $ref: '#/components/schemas/User'
        notes:
          type: string
          nullable: true
        createdAt:
          type: string
          format: date-time

    Document:
      type: object
      properties:
        id:
          type: string
        fileName:
          type: string
        fileSize:
          type: integer
        mimeType:
          type: string
        category:
          type: string
        uploadedBy:
          $ref: '#/components/schemas/User'
        createdAt:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
```

## Components

Based on the architectural patterns, tech stack, and data models from above, here are the major logical components/services and their responsibilities:

### Web Application (Next.js + React)
**Responsibility:** Serves the user interface, handles client-side routing, and manages frontend state

**Key Interfaces:**
- Server-side rendering for initial page loads
- Client-side routing for SPA-like navigation
- API client for backend communication
- WebSocket connection for real-time updates (future)

**Dependencies:** API Service, Authentication Service, Document Service

**Technology Stack:** Next.js 15, React, TypeScript, Shadcn UI, TanStack Query, TanStack Form

### API Service (Hono.js)
**Responsibility:** Handles all REST API endpoints, business logic orchestration, and data validation

**Key Interfaces:**
- RESTful endpoints as defined in API specification
- Request/response validation using ArkType
- Error handling and logging via Pino
- Webhook processing for Acuity events

**Dependencies:** Database Service, Authentication Service, Acuity Integration, Document Service, Cache Service

**Technology Stack:** Hono.js 4.5.0, TypeScript, ArkType for validation, Pino for logging

### Authentication Service (Better Auth)
**Responsibility:** Manages user authentication, authorization, sessions, and organization/team hierarchy

**Key Interfaces:**
- Login/logout endpoints
- Session management
- Role-based access control
- Organization and team membership APIs
- 2FA and phone verification
- Admin impersonation

**Dependencies:** Database Service, SMS Service (for phone verification), Email Service

**Technology Stack:** Better Auth with plugins (admin, organization, 2FA, phone), PostgreSQL for storage

### Database Service (PostgreSQL + Drizzle)
**Responsibility:** Persistent data storage, query optimization, and data integrity

**Key Interfaces:**
- Drizzle ORM repositories for each entity
- Transaction support for complex operations
- Migration management
- Connection pooling

**Dependencies:** None (base layer)

**Technology Stack:** PostgreSQL 15.4, Drizzle ORM 0.33.0, connection pooling via pg-pool

### Document Service
**Responsibility:** Secure document upload, storage, retrieval, and portal-proxy access

**Key Interfaces:**
- Upload API with virus scanning (future)
- Portal-proxied download endpoints
- S3 object management
- Document metadata CRUD
- Multipart upload for large files

**Dependencies:** Database Service (metadata), AWS S3 (storage), Authentication Service (access control)

**Technology Stack:** AWS S3 SDK, Node.js streams for proxy, multer for uploads

### Acuity Integration Service
**Responsibility:** Manages all interactions with Acuity Scheduling API

**Key Interfaces:**
- Appointment creation/update/cancellation
- Availability fetching with caching
- Calendar synchronization
- Webhook event processing
- Specialist calendar mapping

**Dependencies:** Cache Service (for availability), Database Service (for mapping)

**Technology Stack:** Acuity API client, Redis for caching, webhook signature verification

### Cache Service (Redis)
**Responsibility:** Improves performance through strategic caching of frequently accessed data

**Key Interfaces:**
- Key-value storage for session data
- Cached Acuity availability (5-minute TTL)
- Rate limiting counters
- Distributed locks (if needed)

**Dependencies:** None (supporting service)

**Technology Stack:** Redis 7.2, ioredis client

### Email Service
**Responsibility:** Sends transactional emails for bookings, invitations, and notifications

**Key Interfaces:**
- Send invitation emails
- Booking confirmations
- Password reset emails
- 2FA verification codes

**Dependencies:** AWS SES

**Technology Stack:** AWS SES, email templates with React Email

### SMS Service
**Responsibility:** Placeholder for future SMS functionality - currently not implemented

**Key Interfaces:**
- None currently active
- Future: Send verification codes
- Future: Phone number validation

**Dependencies:** None currently (will need SMS provider when implemented)

**Technology Stack:** Not implemented - Better Auth phone plugin will be configured but SMS sending disabled

### Audit Service
**Responsibility:** Captures and forwards all system events to external audit system

**Key Interfaces:**
- Structured logging via Pino
- Event capture for all state changes
- User action attribution
- Impersonation tracking

**Dependencies:** External audit system

**Technology Stack:** Pino logger, structured JSON output

### Component Diagrams

```mermaid
graph TD
    subgraph "Client Layer"
        WEB[Web Application<br/>Next.js + React]
    end
    
    subgraph "API Layer"
        API[API Service<br/>Hono.js]
        AUTH[Authentication Service<br/>Better Auth]
    end
    
    subgraph "Business Services"
        DOC[Document Service]
        ACUITY[Acuity Integration]
        EMAIL[Email Service]
        SMS[SMS Service]
        AUDIT[Audit Service]
    end
    
    subgraph "Data Layer"
        DB[(Database Service<br/>PostgreSQL)]
        CACHE[(Cache Service<br/>Redis)]
        S3[AWS S3<br/>Documents]
    end
    
    WEB --> API
    WEB --> AUTH
    
    API --> AUTH
    API --> DOC
    API --> ACUITY
    API --> DB
    API --> AUDIT
    
    AUTH --> DB
    AUTH --> EMAIL
    AUTH --> SMS
    
    DOC --> S3
    DOC --> DB
    DOC --> AUTH
    
    ACUITY --> CACHE
    ACUITY --> DB
    
    AUDIT --> EXT[External Audit System]
    
    style WEB fill:#99ccff
    style API fill:#99ff99
    style DB fill:#ff9999
```

## External APIs

### Acuity Scheduling API
- **Purpose:** Core calendar and appointment management system for specialist bookings
- **Documentation:** https://developers.acuityscheduling.com/reference
- **Base URL(s):** https://acuityscheduling.com/api/v1
- **Authentication:** HTTP Basic Auth with User ID and API Key
- **Rate Limits:** 10 requests per second, 5000 requests per hour

**Key Endpoints Used:**
- `GET /availability/times?appointmentTypeID={id}&calendarID={id}&date={date}` - Fetch available time slots for specialist
- `POST /appointments` - Create new appointment booking
- `PUT /appointments/{id}` - Update existing appointment
- `DELETE /appointments/{id}` - Cancel appointment
- `GET /appointments/{id}` - Get appointment details
- `GET /calendars` - List available calendars/specialists
- `GET /appointmentTypes` - List appointment types (services offered)
- `GET /forms` - Get form structure for dynamic form generation

**Integration Notes:** 
- Cache availability responses in Redis with 5-minute TTL to avoid rate limits
- Cache appointment types and forms with longer TTL (1 hour) as they change infrequently
- Form structure from `/forms` used to dynamically generate booking forms in UI
- Appointment types determine duration, pricing, and available specialists
- Webhook events provide real-time updates, reducing need for polling
- Always include timezone in date/time requests
- Store Acuity appointment ID for all bookings for synchronization
- Handle API downtime gracefully with user-friendly error messages

### AWS S3 API
- **Purpose:** Secure storage for all medical-legal documents (consent forms, reports, dictations)
- **Documentation:** https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html
- **Base URL(s):** https://s3.ap-southeast-2.amazonaws.com
- **Authentication:** AWS IAM roles with STS temporary credentials
- **Rate Limits:** 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per prefix

**Key Endpoints Used:**
- `PUT /{bucket}/{key}` - Upload document with server-side encryption
- `GET /{bucket}/{key}` - Retrieve document through portal proxy
- `DELETE /{bucket}/{key}` - Permanently delete document
- `POST /{bucket}?uploads` - Initiate multipart upload for large files

**Integration Notes:**
- All documents encrypted at rest using AES-256
- Never expose S3 URLs directly - always proxy through application
- Use presigned URLs internally with short expiration (5 minutes)
- Implement virus scanning before S3 upload (future enhancement)
- Set lifecycle policies for compliance but documents are permanently deleted on request

### AWS SES (Simple Email Service)
- **Purpose:** Send transactional emails for invitations, booking confirmations, and password resets
- **Documentation:** https://docs.aws.amazon.com/ses/latest/dg/Welcome.html
- **Base URL(s):** https://email.ap-southeast-2.amazonaws.com
- **Authentication:** AWS IAM roles
- **Rate Limits:** 14 emails per second (can be increased)

**Key Endpoints Used:**
- `POST /v2/email/outbound-emails` - Send templated emails
- `GET /v2/email/suppression-list` - Check bounced/complained addresses

**Integration Notes:**
- Use production access (not sandbox) for sending to any email
- Implement bounce and complaint handling webhooks
- Template emails using React Email for consistency
- Track email delivery status for audit purposes
- Respect unsubscribe requests for non-essential emails

### Future External APIs (Not Implemented Initially)
- **SMS Provider (Twilio/AWS SNS)** - For phone verification when SMS feature is enabled
- **Payment Gateway** - For processing examination payments (post-MVP)
- **Document Generation API** - For creating formatted reports from templates

## Core Workflows

### Booking Creation Workflow

```mermaid
sequenceDiagram
    participant U as User (Referrer)
    participant W as Web App
    participant API as API Service
    participant Auth as Better Auth
    participant Acuity as Acuity API
    participant DB as Database
    participant Cache as Redis Cache
    participant Audit as Audit Service

    U->>W: Navigate to Create Booking
    W->>API: GET /specialists
    API->>Auth: Validate session
    Auth-->>API: Valid
    API->>DB: Query active specialists
    DB-->>API: Specialist list
    API-->>W: Return specialists
    W-->>U: Display specialist selection

    U->>W: Select specialist & date
    W->>API: GET /specialists/{id}/availability
    API->>Cache: Check cached availability
    alt Cache Miss
        Cache-->>API: No data
        API->>Acuity: GET /availability/times
        Acuity-->>API: Available slots
        API->>Cache: Store (5 min TTL)
    else Cache Hit
        Cache-->>API: Cached slots
    end
    API-->>W: Return time slots
    W-->>U: Display available times

    U->>W: Select time & enter details
    W->>API: POST /bookings
    API->>Auth: Validate session
    API->>Acuity: POST /appointments
    Acuity-->>API: Appointment created
    API->>DB: Create booking record
    API->>DB: Create initial progress
    API->>Audit: Log booking creation
    API-->>W: Return booking details
    W-->>U: Show confirmation

    Note over Acuity: Webhook sent later
    Acuity->>API: POST /webhooks/acuity (scheduled)
    API->>DB: Check existing booking
    DB-->>API: Booking exists
    Note over API: Skip creation (portal-created)
    API->>DB: Update meeting link if telehealth
    API->>Audit: Log webhook processed
```

### Document Upload Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant API as API Service
    participant Auth as Better Auth
    participant S3 as AWS S3
    participant DB as Database
    participant Audit as Audit Service

    U->>W: Navigate to booking details
    W->>API: GET /bookings/{id}
    API->>Auth: Validate session & permissions
    Auth-->>API: Authorized
    API->>DB: Query booking & documents
    DB-->>API: Booking data
    API-->>W: Return booking with documents
    W-->>U: Display booking page

    U->>W: Select files to upload
    W->>W: Validate file type/size
    U->>W: Choose document category
    W->>API: POST /bookings/{id}/documents
    API->>Auth: Validate permissions
    
    loop For each file
        API->>S3: Generate presigned URL
        S3-->>API: Presigned URL
        API->>S3: Upload file (multipart if >5MB)
        S3-->>API: Upload complete
        API->>DB: Create document record
        API->>Audit: Log document upload
    end
    
    API-->>W: Return document metadata
    W-->>U: Show upload success
    W->>W: Update document list
```

### Admin Impersonation Workflow

```mermaid
sequenceDiagram
    participant A as Admin User
    participant W as Web App
    participant API as API Service
    participant Auth as Better Auth
    participant DB as Database
    participant Audit as Audit Service

    A->>W: Access Referrer Search
    W->>API: GET /admin/referrers/search?query=
    API->>Auth: Validate admin role
    Auth-->>API: Is admin
    API->>DB: Search users by name/email/org
    DB-->>API: Matching referrers
    API-->>W: Return search results
    W-->>A: Display referrer list

    A->>W: Click "Act as" on referrer
    W->>API: POST /admin/impersonate
    API->>Auth: Validate admin & create impersonation
    Auth-->>API: Impersonation token
    API->>Audit: Log impersonation start
    API-->>W: Return impersonation context
    W->>W: Update UI with banner
    W-->>A: Show "Acting as [Name]"

    Note over A,W: Admin creates booking as referrer
    A->>W: Create new booking
    W->>API: POST /bookings
    Note over API: Request includes impersonation token
    API->>Auth: Validate impersonation
    API->>DB: Create booking with both IDs
    Note over DB: createdById = referrer<br/>createdForId = admin
    API->>Audit: Log impersonated action
    API-->>W: Booking created
    W-->>A: Show success

    A->>W: Exit impersonation
    W->>API: POST /admin/exit-impersonation
    API->>Auth: Clear impersonation
    API->>Audit: Log impersonation end
    W->>W: Remove banner
    W-->>A: Return to admin view
```

### Webhook Processing Workflow

```mermaid
sequenceDiagram
    participant Acuity as Acuity
    participant Auto as Automation Layer
    participant API as API Service
    participant DB as Database
    participant Email as Email Service
    participant Audit as Audit Service

    Note over Acuity: Appointment created/updated
    Acuity->>Auto: Send webhook event
    Auto->>Auto: Add configured delay
    Auto->>API: POST /webhooks/acuity
    API->>API: Verify signature
    
    alt appointment.scheduled
        API->>DB: Find booking by acuityId
        alt Booking exists
            DB-->>API: Booking found
            Note over API: Portal-created, skip
            opt Has meeting link
                API->>DB: Update meeting link
            end
        else No booking
            DB-->>API: Not found
            API->>DB: Query specialist by calendarId
            API->>DB: Create booking (source: acuity_direct)
            API->>DB: Create initial progress
            API->>Email: Send confirmation
        end
    else appointment.updated
        API->>DB: Find booking
        DB-->>API: Booking found
        API->>DB: Update appointment time
        opt Meeting link changed
            API->>DB: Update meeting link
        end
        API->>DB: Add progress entry
    else appointment.cancelled
        API->>DB: Find booking
        API->>DB: Update status to cancelled
        API->>DB: Add progress entry
        API->>Email: Send cancellation notice
    end
    
    API->>Audit: Log webhook processed
    API-->>Auto: 200 OK
```

## Database Schema

Transform the conceptual data models into concrete database schemas:

```sql
-- Generated by Better Auth CLI
-- Tables: users, accounts, sessions, organizations, organizationMembers, 
-- teams, teamMembers, verifications, etc.

-- Application-specific tables

-- Specialists table
CREATE TABLE specialists (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  acuity_calendar_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255) NOT NULL,
  location VARCHAR(255), -- NULL for telehealth-only
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_specialists_user_id (user_id),
  INDEX idx_specialists_active (is_active),
  INDEX idx_specialists_acuity_calendar (acuity_calendar_id)
);

-- Bookings table
CREATE TABLE bookings (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  acuity_appointment_id VARCHAR(255) NOT NULL UNIQUE,
  specialist_id VARCHAR(255) NOT NULL REFERENCES specialists(id),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id),
  team_id VARCHAR(255) REFERENCES teams(id),
  created_by_id VARCHAR(255) NOT NULL REFERENCES users(id),
  created_for_id VARCHAR(255) REFERENCES users(id), -- For impersonation
  examinee_name VARCHAR(255) NOT NULL,
  examinee_phone VARCHAR(50) NOT NULL,
  examinee_email VARCHAR(255),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  appointment_type VARCHAR(50) NOT NULL CHECK (appointment_type IN ('in_person', 'telehealth')),
  meeting_link TEXT, -- For telehealth appointments
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  current_progress VARCHAR(50) NOT NULL DEFAULT 'scheduled' 
    CHECK (current_progress IN ('scheduled', 'rescheduled', 'cancelled', 'no_show', 
                               'generating_report', 'report_generated', 'payment_received')),
  source VARCHAR(50) NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'acuity_direct')),
  external_created_by VARCHAR(255), -- Who created in Acuity
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_bookings_specialist (specialist_id),
  INDEX idx_bookings_organization (organization_id),
  INDEX idx_bookings_team (team_id),
  INDEX idx_bookings_created_by (created_by_id),
  INDEX idx_bookings_appointment_date (appointment_date),
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_acuity (acuity_appointment_id),
  INDEX idx_bookings_search (examinee_name, examinee_phone)
);

-- Booking progress history
CREATE TABLE booking_progress (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  progress VARCHAR(50) NOT NULL 
    CHECK (progress IN ('scheduled', 'rescheduled', 'cancelled', 'no_show', 
                        'generating_report', 'report_generated', 'payment_received')),
  changed_by_id VARCHAR(255) NOT NULL REFERENCES users(id),
  changed_for_id VARCHAR(255) REFERENCES users(id), -- For impersonation
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_booking_progress_booking (booking_id),
  INDEX idx_booking_progress_created (created_at)
);

-- Documents table
CREATE TABLE documents (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  uploaded_by_id VARCHAR(255) NOT NULL REFERENCES users(id),
  s3_key VARCHAR(500) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL 
    CHECK (category IN ('consent_form', 'brief', 'report', 'dictation', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_documents_booking (booking_id),
  INDEX idx_documents_category (category),
  INDEX idx_documents_uploaded_by (uploaded_by_id)
);

-- Audit logs table
CREATE TABLE audit_logs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- References users but no FK for data retention
  impersonated_user_id VARCHAR(255), -- References users but no FK
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  metadata JSONB,
  ip_address INET NOT NULL,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_resource (resource_type, resource_id),
  INDEX idx_audit_logs_timestamp (timestamp),
  INDEX idx_audit_logs_action (action)
);

-- Webhook events table (for tracking Acuity webhooks)
CREATE TABLE webhook_events (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL DEFAULT 'acuity',
  event_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL, -- Acuity appointment ID
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_webhook_events_source (source),
  INDEX idx_webhook_events_resource (resource_id),
  INDEX idx_webhook_events_processed (processed_at),
  INDEX idx_webhook_events_created (created_at)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_specialists_updated_at BEFORE UPDATE ON specialists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW active_bookings AS
SELECT 
  b.*,
  s.name as specialist_name,
  s.specialty,
  s.location as specialist_location,
  o.name as organization_name,
  t.name as team_name,
  u.name as created_by_name,
  i.name as created_for_name
FROM bookings b
JOIN specialists s ON b.specialist_id = s.id
JOIN organizations o ON b.organization_id = o.id
LEFT JOIN teams t ON b.team_id = t.id
JOIN users u ON b.created_by_id = u.id
LEFT JOIN users i ON b.created_for_id = i.id
WHERE b.status = 'active';

-- Indexes for performance
CREATE INDEX idx_bookings_composite_filter 
  ON bookings(status, appointment_date, specialist_id) 
  WHERE status = 'active';

CREATE INDEX idx_documents_booking_category 
  ON documents(booking_id, category);

-- Constraints
ALTER TABLE bookings 
  ADD CONSTRAINT valid_appointment_date 
  CHECK (appointment_date > created_at);

ALTER TABLE documents 
  ADD CONSTRAINT valid_file_size 
  CHECK (file_size > 0 AND file_size <= 524288000); -- 500MB max
```

## Frontend Architecture

### Component Architecture

#### Component Organization
```text
app/
├── (auth)/                    # Auth layout group
│   ├── login/
│   ├── reset-password/
│   └── verify/
├── (dashboard)/              # Dashboard layout group
│   ├── layout.tsx           # Dashboard shell with nav
│   ├── bookings/
│   │   ├── page.tsx        # Bookings list/calendar view
│   │   ├── [id]/
│   │   │   └── page.tsx    # Booking detail page
│   │   └── new/
│   │       └── page.tsx    # Create booking wizard
│   ├── documents/
│   └── settings/
├── admin/                    # Admin-only routes
│   ├── impersonate/
│   └── audit/
├── api/                     # API routes (Hono)
│   └── [[...route]]/
│       └── route.ts        # Hono app entry
└── components/
    ├── ui/                  # Shadcn UI components
    ├── bookings/           # Booking-specific components
    ├── documents/          # Document components
    ├── forms/              # Form components
    └── layout/             # Layout components
```

#### Component Template
```typescript
// Example: BookingCard component
import { type FC } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { Booking } from '@/types/booking';

interface BookingCardProps {
  booking: Booking;
  onSelect?: (booking: Booking) => void;
}

export const BookingCard: FC<BookingCardProps> = ({ 
  booking, 
  onSelect 
}) => {
  const statusColor = {
    active: 'bg-green-500',
    closed: 'bg-gray-500',
    archived: 'bg-gray-700'
  }[booking.status];

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect?.(booking)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">{booking.examineeName}</h3>
          <Badge className={statusColor}>
            {booking.currentProgress}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {booking.specialist.name} • {formatDate(booking.appointmentDate)}
        </p>
        {booking.appointmentType === 'telehealth' && (
          <Badge variant="outline" className="mt-2">
            Telehealth
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
```

### State Management Architecture

#### State Structure
```typescript
// Global state managed by TanStack Query
// No client-side global state needed - all server state

// Query keys factory
export const queryKeys = {
  all: ['bookings'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters: BookingFilters) => 
    [...queryKeys.lists(), filters] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
};

// Example query hook
export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.list(filters),
    queryFn: () => api.bookings.list(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Mutations with optimistic updates
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.bookings.create,
    onMutate: async (newBooking) => {
      // Optimistic update
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.lists() 
      });
      
      const previousBookings = queryClient.getQueryData(
        queryKeys.lists()
      );
      
      queryClient.setQueryData(queryKeys.lists(), (old) => {
        return [...(old || []), newBooking];
      });
      
      return { previousBookings };
    },
    onError: (err, newBooking, context) => {
      // Rollback on error
      queryClient.setQueryData(
        queryKeys.lists(),
        context?.previousBookings
      );
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.lists() 
      });
    },
  });
}
```

#### State Management Patterns
- Server state via TanStack Query with aggressive caching
- Form state via TanStack Form
- UI state via React useState for local component state
- URL state via Next.js router for filters and pagination
- No Redux/Zustand needed - server state is source of truth

### Routing Architecture

#### Route Organization
```text
app/
├── (auth)/
│   └── login/page.tsx              # /login
├── (dashboard)/
│   ├── page.tsx                    # / (redirects to /bookings)
│   ├── bookings/
│   │   ├── page.tsx               # /bookings (list/calendar)
│   │   ├── [id]/page.tsx          # /bookings/:id (detail)
│   │   └── new/page.tsx           # /bookings/new (create)
│   └── documents/page.tsx         # /documents
└── admin/
    ├── impersonate/page.tsx       # /admin/impersonate
    └── audit/page.tsx             # /admin/audit
```

#### Protected Route Pattern
```typescript
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardNav } from '@/components/layout/dashboard-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen">
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// Middleware for role-based access
// middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function middleware(request: Request) {
  const session = await auth();
  
  // Admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (session?.user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/(dashboard)/:path*'],
};
```

### Frontend Services Layer

#### API Client Setup
```typescript
// lib/api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '@/app/api/[[...route]]/route';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

// Type-safe API client
export const api = hc<AppType>(baseUrl, {
  headers: () => ({
    'Content-Type': 'application/json',
  }),
  fetch: (input, init) => {
    // Add auth token from cookies
    return fetch(input, {
      ...init,
      credentials: 'include',
    });
  },
});

// With error handling
export async function apiRequest<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Response) {
      const data = await error.json();
      throw new ApiError(data.message, error.status, data);
    }
    throw error;
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: any
  ) {
    super(message);
  }
}
```

#### Service Example
```typescript
// services/bookings.service.ts
import { api, apiRequest } from '@/lib/api-client';
import type { Booking, BookingFormData } from '@/types/booking';

export const bookingsService = {
  async list(filters?: BookingFilters) {
    return apiRequest(() => 
      api.bookings.$get({ query: filters })
    );
  },
  
  async get(id: string) {
    return apiRequest(() => 
      api.bookings[':id'].$get({ param: { id } })
    );
  },
  
  async create(data: BookingFormData) {
    // First create Acuity appointment
    const response = await apiRequest(() =>
      api.bookings.$post({ json: data })
    );
    
    return response;
  },
  
  async updateProgress(id: string, progress: string, notes?: string) {
    return apiRequest(() =>
      api.bookings[':id'].progress.$post({
        param: { id },
        json: { progress, notes }
      })
    );
  },
};

// React Query integration
export function useBooking(id: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsService.get(id),
    enabled: !!id,
  });
}
```

## Backend Architecture

### Service Architecture

#### Traditional Server Architecture

##### Controller/Route Organization
```text
app/
└── api/
    └── [[...route]]/
        └── route.ts          # Main Hono app
server/
├── routes/                   # Route definitions
│   ├── auth.routes.ts
│   ├── bookings.routes.ts
│   ├── documents.routes.ts
│   ├── specialists.routes.ts
│   └── admin.routes.ts
├── services/                 # Business logic
│   ├── booking.service.ts
│   ├── document.service.ts
│   ├── acuity.service.ts
│   └── audit.service.ts
├── repositories/            # Data access layer
│   ├── booking.repository.ts
│   └── document.repository.ts
├── middleware/              # Hono middleware
│   ├── auth.middleware.ts
│   ├── validate.middleware.ts
│   └── audit.middleware.ts
└── lib/                     # Utilities
    ├── db.ts               # Drizzle client
    ├── redis.ts            # Redis client
    └── s3.ts               # S3 client
```

##### Controller Template
```typescript
// server/routes/bookings.routes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { type } from 'arktype';
import { bookingService } from '@/server/services/booking.service';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { validate } from '@/server/middleware/validate.middleware';

const bookingsRouter = new Hono()
  .use('*', authMiddleware)
  
  // List bookings with filters
  .get('/', 
    validate('query', type({
      status: "'active' | 'closed' | 'archived' | undefined",
      specialistIds: "string[] | undefined",
      search: "string | undefined",
      page: "number | undefined",
      limit: "number | undefined",
    })),
    async (c) => {
      const filters = c.req.valid('query');
      const user = c.get('user');
      
      const { data, pagination } = await bookingService.list(
        user,
        filters
      );
      
      return c.json({ data, pagination });
    }
  )
  
  // Create booking
  .post('/',
    validate('json', type({
      specialistId: "string",
      appointmentDateTime: "Date | string",
      examineeName: "string.trim",
      examineePhone: "string.trim",
      "examineeEmail?": "string.email",
      "notes?": "string",
    }).pipe((data) => ({
      ...data,
      appointmentDateTime: new Date(data.appointmentDateTime),
    }))),
    async (c) => {
      const data = c.req.valid('json');
      const user = c.get('user');
      
      const booking = await bookingService.create(user, data);
      
      return c.json(booking, 201);
    }
  )
  
  // Get booking details
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const booking = await bookingService.getById(user, id);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    return c.json(booking);
  })
  
  // Update booking progress
  .post('/:id/progress',
    validate('json', type({
      progress: `'scheduled' | 'rescheduled' | 'cancelled' | 
                 'no_show' | 'generating_report' | 'report_generated' | 
                 'payment_received'`,
      "notes?": "string",
    })),
    async (c) => {
      const id = c.req.param('id');
      const data = c.req.valid('json');
      const user = c.get('user');
      
      const progress = await bookingService.updateProgress(
        user,
        id,
        data
      );
      
      return c.json(progress, 201);
    }
  );

export { bookingsRouter };
```

### Database Architecture

#### Schema Design
```typescript
// server/db/schema.ts
import { pgTable, varchar, timestamp, boolean, text, bigint, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const specialists = pgTable('specialists', {
  id: varchar('id', { length: 255 }).primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  acuityCalendarId: varchar('acuity_calendar_id', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_specialists_user_id').on(table.userId),
  activeIdx: index('idx_specialists_active').on(table.isActive),
  acuityIdx: index('idx_specialists_acuity_calendar').on(table.acuityCalendarId),
}));

export const bookings = pgTable('bookings', {
  id: varchar('id', { length: 255 }).primaryKey().defaultRandom(),
  acuityAppointmentId: varchar('acuity_appointment_id', { length: 255 }).notNull().unique(),
  specialistId: varchar('specialist_id', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  teamId: varchar('team_id', { length: 255 }),
  createdById: varchar('created_by_id', { length: 255 }).notNull(),
  createdForId: varchar('created_for_id', { length: 255 }),
  examineeName: varchar('examinee_name', { length: 255 }).notNull(),
  examineePhone: varchar('examinee_phone', { length: 50 }).notNull(),
  examineeEmail: varchar('examinee_email', { length: 255 }),
  appointmentDate: timestamp('appointment_date', { withTimezone: true }).notNull(),
  appointmentType: varchar('appointment_type', { length: 50 }).notNull(),
  meetingLink: text('meeting_link'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  currentProgress: varchar('current_progress', { length: 50 }).notNull().default('scheduled'),
  source: varchar('source', { length: 50 }).notNull().default('portal'),
  externalCreatedBy: varchar('external_created_by', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  specialistIdx: index('idx_bookings_specialist').on(table.specialistId),
  organizationIdx: index('idx_bookings_organization').on(table.organizationId),
  appointmentDateIdx: index('idx_bookings_appointment_date').on(table.appointmentDate),
  statusIdx: index('idx_bookings_status').on(table.status),
  acuityIdx: index('idx_bookings_acuity').on(table.acuityAppointmentId),
}));

// Relations
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  specialist: one(specialists, {
    fields: [bookings.specialistId],
    references: [specialists.id],
  }),
  progress: many(bookingProgress),
  documents: many(documents),
}));
```

#### Data Access Layer
```typescript
// server/repositories/booking.repository.ts
import { db } from '@/server/lib/db';
import { bookings, bookingProgress, specialists } from '@/server/db/schema';
import { eq, and, inArray, like, gte, lte } from 'drizzle-orm';
import type { BookingFilters, PaginationParams } from '@/types';

export const bookingRepository = {
  async findMany(
    organizationId: string,
    filters: BookingFilters & PaginationParams
  ) {
    const conditions = [
      eq(bookings.organizationId, organizationId),
    ];
    
    if (filters.status) {
      conditions.push(eq(bookings.status, filters.status));
    }
    
    if (filters.specialistIds?.length) {
      conditions.push(inArray(bookings.specialistId, filters.specialistIds));
    }
    
    if (filters.search) {
      conditions.push(
        like(bookings.examineeName, `%${filters.search}%`)
      );
    }
    
    if (filters.startDate) {
      conditions.push(gte(bookings.appointmentDate, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(bookings.appointmentDate, filters.endDate));
    }
    
    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;
    
    const [data, count] = await Promise.all([
      db.query.bookings.findMany({
        where: and(...conditions),
        with: {
          specialist: true,
          progress: {
            orderBy: (progress, { desc }) => [desc(progress.createdAt)],
            limit: 1,
          },
        },
        limit,
        offset,
        orderBy: (bookings, { desc }) => [desc(bookings.appointmentDate)],
      }),
      db.select({ count: count() })
        .from(bookings)
        .where(and(...conditions)),
    ]);
    
    return {
      data,
      pagination: {
        page: filters.page || 1,
        limit,
        total: count[0].count,
        totalPages: Math.ceil(count[0].count / limit),
      },
    };
  },
  
  async findById(id: string, organizationId: string) {
    return db.query.bookings.findFirst({
      where: and(
        eq(bookings.id, id),
        eq(bookings.organizationId, organizationId)
      ),
      with: {
        specialist: true,
        progress: {
          orderBy: (progress, { desc }) => [desc(progress.createdAt)],
        },
        documents: {
          orderBy: (documents, { desc }) => [desc(documents.createdAt)],
        },
      },
    });
  },
  
  async create(data: typeof bookings.$inferInsert) {
    const [booking] = await db.insert(bookings)
      .values(data)
      .returning();
    
    // Create initial progress entry
    await db.insert(bookingProgress).values({
      bookingId: booking.id,
      progress: 'scheduled',
      changedById: data.createdById,
      changedForId: data.createdForId,
      notes: 'Booking created',
    });
    
    return booking;
  },
  
  async updateProgress(
    id: string,
    progress: string,
    changedById: string,
    changedForId?: string,
    notes?: string
  ) {
    // Update current progress
    await db.update(bookings)
      .set({ currentProgress: progress })
      .where(eq(bookings.id, id));
    
    // Add progress entry
    const [entry] = await db.insert(bookingProgress)
      .values({
        bookingId: id,
        progress,
        changedById,
        changedForId,
        notes,
      })
      .returning();
    
    return entry;
  },
};
```

### Authentication and Authorization

#### Auth Flow
```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant BA as Better Auth
    participant DB as Database
    
    C->>A: POST /auth/login
    A->>BA: Verify credentials
    BA->>DB: Check user/org/team
    DB-->>BA: User data
    BA-->>A: Session created
    A-->>C: Set cookie + user data
    
    C->>A: GET /bookings (with cookie)
    A->>BA: Verify session
    BA-->>A: Session valid + user/org
    A->>A: Check permissions
    A->>DB: Query with org filter
    DB-->>A: Filtered bookings
    A-->>C: Return bookings
```

#### Middleware/Guards
```typescript
// server/middleware/auth.middleware.ts
import { auth } from '@/lib/auth';
import type { Context, Next } from 'hono';

export async function authMiddleware(c: Context, next: Next) {
  const session = await auth();
  
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Add user to context
  c.set('user', session.user);
  c.set('organization', session.organization);
  c.set('impersonating', session.impersonating);
  
  await next();
}

// Role-based middleware
export function requireRole(role: 'admin' | 'user') {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (user.role !== role && role === 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    await next();
  };
}

// Organization-based access
export async function checkBookingAccess(
  c: Context,
  bookingId: string
) {
  const user = c.get('user');
  const booking = await bookingRepository.findById(
    bookingId,
    user.organizationId
  );
  
  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }
  
  // Additional checks based on role
  if (user.role === 'specialist') {
    if (booking.specialistId !== user.specialistId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }
  
  return booking;
}
```

## Unified Project Structure

```plaintext
medibytes-booking/
├── .github/                          # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml                   # Test and lint on PR
│       └── deploy.yaml               # Deploy to AWS ECS
├── app/                              # Next.js app directory
│   ├── (auth)/                       # Auth layout group
│   │   ├── layout.tsx                # Minimal auth layout
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── reset-password/
│   │   │   └── page.tsx              # Password reset
│   │   └── verify/
│   │       └── page.tsx              # Email/phone verification
│   ├── (dashboard)/                  # Main app layout group
│   │   ├── layout.tsx                # Dashboard shell with nav
│   │   ├── page.tsx                  # Redirect to /bookings
│   │   ├── bookings/
│   │   │   ├── page.tsx              # Calendar/list view
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Booking detail
│   │   │   └── new/
│   │   │       └── page.tsx          # Create booking wizard
│   │   ├── documents/
│   │   │   └── page.tsx              # Document management
│   │   └── settings/
│   │       ├── page.tsx              # User settings
│   │       └── organization/
│   │           └── page.tsx          # Org settings
│   ├── admin/                        # Admin-only routes
│   │   ├── layout.tsx                # Admin layout
│   │   ├── impersonate/
│   │   │   └── page.tsx              # Referrer search
│   │   └── audit/
│   │       └── page.tsx              # Audit logs
│   ├── api/                          # API routes
│   │   └── [[...route]]/
│   │       └── route.ts              # Hono app handler
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Landing/redirect
│   └── providers.tsx                 # Client providers
├── components/                       # React components
│   ├── ui/                           # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...                       # Other UI components
│   ├── bookings/                     # Booking components
│   │   ├── booking-card.tsx
│   │   ├── booking-calendar.tsx
│   │   ├── booking-list.tsx
│   │   ├── booking-filters.tsx
│   │   └── specialist-select.tsx
│   ├── documents/                    # Document components
│   │   ├── document-upload.tsx
│   │   ├── document-list.tsx
│   │   └── document-viewer.tsx
│   ├── forms/                        # Form components
│   │   ├── booking-form.tsx
│   │   ├── examinee-form.tsx
│   │   └── progress-form.tsx
│   └── layout/                       # Layout components
│       ├── dashboard-nav.tsx
│       ├── user-menu.tsx
│       ├── impersonation-banner.tsx
│       └── mobile-nav.tsx
├── server/                           # Backend code
│   ├── routes/                       # API route handlers
│   │   ├── auth.routes.ts
│   │   ├── bookings.routes.ts
│   │   ├── documents.routes.ts
│   │   ├── specialists.routes.ts
│   │   ├── admin.routes.ts
│   │   └── webhooks.routes.ts
│   ├── services/                     # Business logic
│   │   ├── booking.service.ts
│   │   ├── document.service.ts
│   │   ├── acuity.service.ts
│   │   ├── email.service.ts
│   │   └── audit.service.ts
│   ├── repositories/                 # Data access
│   │   ├── booking.repository.ts
│   │   ├── document.repository.ts
│   │   └── specialist.repository.ts
│   ├── middleware/                   # Hono middleware
│   │   ├── auth.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── audit.middleware.ts
│   │   └── error.middleware.ts
│   ├── db/                           # Database
│   │   ├── schema.ts                 # Drizzle schema
│   │   └── migrations/               # SQL migrations
│   └── app.ts                        # Hono app setup
├── lib/                              # Shared utilities
│   ├── auth.ts                       # Better Auth setup
│   ├── db.ts                         # Drizzle client
│   ├── redis.ts                      # Redis client
│   ├── s3.ts                         # S3 client
│   ├── api-client.ts                 # Frontend API client
│   ├── utils.ts                      # Shared utilities
│   └── constants.ts                  # App constants
├── hooks/                            # React hooks
│   ├── use-bookings.ts
│   ├── use-specialists.ts
│   └── use-impersonation.ts
├── types/                            # TypeScript types
│   ├── booking.ts
│   ├── document.ts
│   ├── user.ts
│   └── api.ts
├── styles/                           # Global styles
│   └── globals.css                   # Tailwind imports
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

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Required tools
node >= 20.11.0
pnpm >= 9.5.0
docker >= 24.0.0
docker-compose >= 2.20.0

# Optional but recommended
aws-cli >= 2.13.0
postgresql-client >= 15
```

#### Initial Setup
```bash
# Clone repository
git clone https://github.com/medibytes/booking-platform.git
cd booking-platform

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start local services (PostgreSQL, Redis)
docker-compose up -d

# Generate Better Auth tables
pnpm auth:generate

# Run database migrations
pnpm db:migrate

# Seed initial data (creates admin user, test specialists)
pnpm db:seed

# Start development server
pnpm dev
```

#### Development Commands
```bash
# Start all services
pnpm dev

# Start frontend only
pnpm dev:frontend

# Start backend only
pnpm dev:backend

# Run tests
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e          # E2E tests (requires running app)

# Code quality
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix linting issues
pnpm format            # Run Prettier
pnpm typecheck         # TypeScript type checking

# Database commands
pnpm db:generate       # Generate migration from schema changes
pnpm db:migrate        # Apply pending migrations
pnpm db:studio         # Open Drizzle Studio
pnpm db:seed           # Seed test data

# Build commands
pnpm build             # Build for production
pnpm start             # Start production server
```

### Environment Configuration

#### Required Environment Variables
```bash
# Frontend (.env.local)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Backend (.env)
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/medibytes_booking
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# AWS Services
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=medibytes-documents-dev

# Acuity Scheduling
ACUITY_USER_ID=your-acuity-user-id
ACUITY_API_KEY=your-acuity-api-key
ACUITY_WEBHOOK_SECRET=your-webhook-secret

# Email (AWS SES)
EMAIL_FROM=noreply@medibytes.com.au
AWS_SES_REGION=ap-southeast-2

# Shared
NODE_ENV=development
LOG_LEVEL=debug
```

## Deployment Architecture

### Deployment Strategy

**Frontend Deployment:**
- **Platform:** AWS ECS with Fargate
- **Build Command:** `pnpm build`
- **Output Directory:** `.next` (handled by Next.js)
- **CDN/Edge:** CloudFront for static assets

**Backend Deployment:**
- **Platform:** Same ECS container as frontend
- **Build Command:** Included in `pnpm build`
- **Deployment Method:** Docker container with Node.js

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-southeast-2
  ECR_REPOSITORY: medibytes-booking
  ECS_SERVICE: medibytes-booking-service
  ECS_CLUSTER: medibytes-cluster

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9.5.0
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run tests
        run: |
          pnpm lint
          pnpm typecheck
          pnpm test:unit
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
        
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|--------------|-------------|---------|
| Development | http://localhost:3000 | http://localhost:3000/api | Local development |
| Staging | https://staging.medibytes-booking.com.au | https://staging.medibytes-booking.com.au/api | Pre-production testing |
| Production | https://booking.medibytes.com.au | https://booking.medibytes.com.au/api | Live environment |

## Security and Performance

### Security Requirements

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

### Performance Optimization

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

## Testing Strategy

### Testing Pyramid
```
        E2E Tests (10%)
       /              \
    Integration Tests (30%)
   /                      \
Frontend Unit Tests | Backend Unit Tests (60%)
```

### Test Organization

#### Frontend Tests
```text
tests/
├── unit/
│   ├── components/
│   │   ├── booking-card.test.tsx
│   │   └── specialist-select.test.tsx
│   └── hooks/
│       └── use-bookings.test.ts
└── e2e/
    └── booking-flow.spec.ts
```

#### Backend Tests
```text
tests/
├── unit/
│   ├── services/
│   │   ├── booking.service.test.ts
│   │   └── acuity.service.test.ts
│   └── repositories/
│       └── booking.repository.test.ts
└── integration/
    └── api/
        ├── bookings.test.ts
        └── documents.test.ts
```

### Test Examples

#### Frontend Component Test
```typescript
// tests/unit/components/booking-card.test.tsx
import { render, screen } from '@testing-library/react';
import { BookingCard } from '@/components/bookings/booking-card';
import { mockBooking } from '@/tests/fixtures';

describe('BookingCard', () => {
  it('displays booking information correctly', () => {
    render(<BookingCard booking={mockBooking} />);
    
    expect(screen.getByText(mockBooking.examineeName)).toBeInTheDocument();
    expect(screen.getByText(mockBooking.specialist.name)).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
  });
  
  it('shows telehealth badge for online appointments', () => {
    const telehealthBooking = {
      ...mockBooking,
      appointmentType: 'telehealth' as const,
    };
    
    render(<BookingCard booking={telehealthBooking} />);
    
    expect(screen.getByText('Telehealth')).toBeInTheDocument();
  });
});
```

#### Backend API Test
```typescript
// tests/integration/api/bookings.test.ts
import { app } from '@/server/app';
import { db } from '@/server/lib/db';
import { createTestUser, createTestBooking } from '@/tests/helpers';

describe('POST /api/bookings', () => {
  let authToken: string;
  let user: any;
  
  beforeEach(async () => {
    await db.delete(bookings);
    user = await createTestUser({ role: 'user' });
    authToken = await getAuthToken(user);
  });
  
  it('creates a new booking successfully', async () => {
    const bookingData = {
      specialistId: 'specialist-123',
      appointmentDateTime: '2024-02-01T10:00:00Z',
      examineeName: 'John Doe',
      examineePhone: '0400123456',
    };
    
    const response = await app.request('/api/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });
    
    expect(response.status).toBe(201);
    const booking = await response.json();
    expect(booking.examineeName).toBe('John Doe');
    expect(booking.source).toBe('portal');
  });
});
```

#### E2E Test
```typescript
// tests/e2e/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Creation Flow', () => {
  test('user can create a booking successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'referrer@lawfirm.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to create booking
    await page.waitForURL('/bookings');
    await page.click('text=Create Booking');
    
    // Select specialist
    await page.click('[data-specialist-id="specialist-123"]');
    await page.click('text=Continue');
    
    // Select time slot
    await page.click('[data-slot="2024-02-01T10:00:00"]');
    await page.click('text=Continue');
    
    // Enter examinee details
    await page.fill('[name="examineeName"]', 'John Doe');
    await page.fill('[name="examineePhone"]', '0400123456');
    await page.fill('[name="examineeEmail"]', 'john@example.com');
    
    // Submit
    await page.click('text=Create Booking');
    
    // Verify success
    await expect(page).toHaveURL(/\/bookings\/[a-z0-9-]+/);
    await expect(page.locator('h1')).toContainText('John Doe');
    await expect(page.locator('text=scheduled')).toBeVisible();
  });
});
```

## Coding Standards

### Critical Fullstack Rules
- **Type Sharing:** Always define types in `types/` directory and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer with api-client
- **Environment Variables:** Access only through validated env object from @t3-oss/env-nextjs
- **Error Handling:** All API routes must use the standard error handler middleware
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Document Access:** Always use portal-proxy - never expose S3 URLs
- **Audit Logging:** Every state change must be logged via audit service
- **Validation:** Use ArkType for ALL input validation - no exceptions
- **Authentication:** Check permissions at the service layer, not just middleware
- **Database Access:** Only through repositories - no direct Drizzle queries in services

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `BookingCard.tsx` |
| Hooks | camelCase with 'use' | - | `useBookings.ts` |
| API Routes | - | kebab-case | `/api/booking-progress` |
| Database Tables | - | snake_case | `booking_progress` |
| Services | - | camelCase | `bookingService.ts` |
| Types/Interfaces | PascalCase | PascalCase | `BookingFormData` |

## Error Handling Strategy

### Error Flow
```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as API Route
    participant S as Service
    participant D as Database
    
    F->>A: Request
    A->>S: Call service
    S->>D: Query
    D-->>S: Error
    S-->>S: Wrap in AppError
    S-->>A: Throw AppError
    A-->>A: Error middleware
    A-->>F: Formatted response
    F-->>F: Show user message
```

### Error Response Format
```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling
```typescript
// hooks/use-error-handler.ts
export function useErrorHandler() {
  return (error: unknown) => {
    if (error instanceof ApiError) {
      // Show specific error message
      toast.error(error.message);
    } else if (error instanceof NetworkError) {
      toast.error('Connection failed. Please check your internet.');
    } else {
      toast.error('Something went wrong. Please try again.');
      console.error(error);
    }
  };
}
```

### Backend Error Handling
```typescript
// server/middleware/error.middleware.ts
export function errorMiddleware(err: Error, c: Context) {
  const requestId = c.get('requestId');
  
  // Log to audit system
  logger.error({
    error: err.message,
    stack: err.stack,
    requestId,
    userId: c.get('user')?.id,
  });
  
  if (err instanceof AppError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        requestId,
      }
    }, err.statusCode);
  }
  
  // Don't leak internal errors
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    }
  }, 500);
}
```

## Monitoring and Observability

### Monitoring Stack
- **Frontend Monitoring:** Browser console logs + future Sentry integration
- **Backend Monitoring:** CloudWatch Logs with Pino structured logging
- **Error Tracking:** CloudWatch Logs queries for error analysis
- **Performance Monitoring:** CloudWatch Metrics for API response times

### Key Metrics

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

## Checklist Results Report

_To be completed after architecture review_

## Next Steps

The architecture is now complete and ready for implementation. Key next steps:

1. **Set up development environment** following the setup instructions
2. **Initialize Better Auth** with all required plugins
3. **Create database schema** using Drizzle migrations
4. **Implement core booking flow** as the first feature
5. **Add document management** once bookings work
6. **Deploy to AWS** using the CDK infrastructure

### Developer Handoff

For the development team:
1. Review the complete architecture document
2. Set up local development environment
3. Run Better Auth CLI to generate auth tables
4. Create initial database migrations from schema
5. Begin with Epic 1: Foundation & Authentication Infrastructure
6. Use the defined tech stack versions exactly as specified
7. Follow the coding standards and error handling patterns
8. Implement comprehensive logging from day one

### Architect Prompt for Frontend Focus

If additional frontend-specific architecture is needed:

"Please create detailed frontend architecture documentation for the Medical Examination Booking Platform, expanding on the frontend sections of this fullstack architecture. Focus on component composition patterns, advanced state management scenarios, performance optimization strategies, and detailed responsive design breakpoints. Include specific implementation patterns for the booking wizard, calendar view, and document upload components."