# Medical Examination Booking Platform Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Enable referrers to create IME bookings directly without phone calls in under 3 minutes
- Provide real-time visibility into booking status and progress across all stakeholders  
- Ensure HIPAA and Privacy Act 1988/APPs compliance for all medical-legal document handling
- Reduce administrative burden by 80% through self-service booking capabilities
- Support 150+ bookings/month without additional admin staff
- Create comprehensive audit trails for legal compliance requirements
- Streamline report generation through specialist dictation and admin transcription workflow

### Background Context
The Medical Examination Booking Platform addresses a critical inefficiency in Australia's personal injury legal system. Law firms are required by regulation to work through intermediary services when booking Independent Medical Examinations with specialists. Currently, this process relies on manual phone coordination, creating 15-20 minute booking times, limited visibility, and compliance risks. With 50+ active referrers and ~90 bookings monthly, the current system wastes approximately 27 hours of staff time on coordination alone. This platform digitizes the entire IME workflow, providing a secure, role-based portal that serves as the central hub for all stakeholders while maintaining strict compliance with medical privacy regulations.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-13 | 1.0 | Initial PRD creation | John (PM) |

## Requirements

### Functional
- FR1: The system shall provide secure authentication using Better Auth with admin and organization plugin roles
- FR2: Admin users shall be able to impersonate referrers with clear UI indication and full audit trails
- FR3: Referrers shall create bookings by selecting specialists and time slots via Acuity integration
- FR4: The system shall display bookings in three views: Calendar, List (with filters), and Detail pages
- FR5: Bookings shall track status (Active/Closed/Archived) and progress stages with timestamps
- FR6: Users shall upload documents in a two-stage workflow (booking first, then documents)
- FR7: The system shall provide portal-proxied document downloads with access validation
- FR8: Documents shall be categorized by type including consent forms, briefs, reports, and dictations
- FR9: The system shall support multiple roles per user except for specialists
- FR10: Specialists shall be linked to users via calendarId mapping for Acuity integration

### Non Functional
- NFR1: All pages shall load within 2 seconds on standard broadband connections
- NFR2: The platform shall support 100+ concurrent users without performance degradation
- NFR3: All PHI data shall be encrypted in transit (TLS 1.2+) and at rest (AES-256)
- NFR4: The system shall maintain 99.9% uptime excluding planned maintenance windows
- NFR5: File uploads shall support documents up to 100MB for medical records
- NFR6: The system shall pass HIPAA and Privacy Act 1988/APPs compliance audits
- NFR7: All user actions on PHI shall be logged with comprehensive audit trails using Pino
- NFR8: The system shall prevent direct S3 access to documents (portal-proxy only)

## User Interface Design Goals

### Overall UX Vision
A clean, professional interface that reflects the medical-legal context while prioritizing efficiency and clarity. The design should feel trustworthy and secure, with minimal cognitive load for busy legal professionals. Every interaction should reinforce the platform's reliability and compliance standards.

### Key Interaction Paradigms
- **Quick Actions First:** Most common tasks (create booking, upload documents) prominently accessible
- **Progressive Disclosure:** Show essential information upfront, details on demand
- **Status-Driven Navigation:** Visual indicators guide users through the booking workflow
- **Role-Aware Interface:** UI adapts based on user permissions (admin, referrer, specialist)
- **Transparent Logging:** All actions are logged to external audit system via Pino

### Core Screens and Views
- Login/Authentication Screen (with organization selection)
- Main Dashboard (role-specific landing page)
- Booking Creation Wizard (specialist selection → time slot → examinee details)
- Calendar View with filters:
  - Status filter: Active (status active + scheduled/rescheduled/generating-report/report-generated) or Closed (status closed/archived + no-show/cancelled/payment-received)
  - Specialist filter (multi-select, show all if none selected)
  - Search input (examinee-specific search)
- Bookings List View with same filtering options as Calendar View
- Booking Detail Page (comprehensive view with documents and status)
- Document Management Interface (upload/download with categories)
- Referrer Search & Impersonation Interface (admin only)

### Accessibility: WCAG AA
- High contrast ratios for text readability
- Keyboard navigation support for all interactions
- Screen reader compatibility for vision-impaired users
- Clear focus indicators and form labels

### Branding
Professional medical-legal aesthetic using #a2826c as the primary accent color (warm bronze/taupe). Supporting palette includes:
- Primary accent: #a2826c (buttons, links, active states)
- Neutral grays: #f7f5f3 (light backgrounds), #e8e5e1 (borders), #6b6560 (text)
- Status colors: muted greens for success, warm ambers for warnings
- Clean typography with high readability, conservative layout emphasizing trust and professionalism

### Target Device and Platforms: Web Responsive
- Primary: Desktop browsers for office use
- Secondary: Tablet/mobile for on-the-go access
- Responsive design ensuring functionality across all screen sizes

## Technical Assumptions

### Repository Structure: Single Repository
- Standard Next.js project structure with integrated Hono backend
- Hono installed as a dependency within the Next.js project
- Backend API handled through router.ts file in the Next.js app
- Shared types and utilities within the same codebase

### Service Architecture
Integrated Next.js + Hono architecture:
- Next.js serves as the main application framework
- Hono.js integrated via router.ts to handle API endpoints
- API routes served directly through Next.js server
- Stateless backend services enabling horizontal scaling
- Queue system for async operations (document processing)
- Frontend and backend deployed as a single unit

### Testing Requirements
Full Testing Pyramid approach:
- Unit tests for business logic and utilities
- Integration tests for API endpoints and database operations
- E2E tests for critical user flows (booking creation, document upload)
- Manual testing convenience methods for QA workflows
- Minimum 80% code coverage for backend services

### Additional Technical Assumptions and Requests
- **Frontend Stack:** Next.js 15 App Router, TypeScript, Shadcn UI, TanStack Query/Table/Form
- **Backend Stack:** Hono.js (via Next.js handler), Drizzle ORM, PostgreSQL 15+, Better Auth with plugins: admin, organization, 2fa, phone number, email otp
- **Infrastructure:** AWS EC2/ECS for hosting, S3 for PHI documents, RDS for PostgreSQL, no CDN for PHI
- **Security:** Portal-proxied downloads only
- **Deployment:** Docker container via AWS ECS
- **Development:** Standard Next.js project structure, ESLint/Prettier for code quality
- **Monitoring:** AWS CloudWatch for logs/metrics, Sentry for error tracking
- **API Design:** RESTful endpoints via Hono routes with consistent naming conventions

## Epic List

**Epic 1: Foundation & Authentication Infrastructure**  
Establish project setup, authentication system with Better Auth (including all plugins), role-based permissions, and deliver initial landing pages with health check endpoint

**Epic 2: Booking Management Core**  
Create the complete booking workflow including Acuity integration, calendar/list views with filtering, booking detail pages, and status/progress tracking system

**Epic 3: Document Management System**  
Implement secure document upload/download with portal-proxied access, document categorization, role-based visibility, and the two-stage workflow (booking first, then documents)

**Epic 4: Admin Impersonation & Audit Integration**  
Build the referrer search and impersonation interface for admins to create bookings on behalf of referrers, implement comprehensive audit logging for all actions, and ensure proper attribution for impersonated actions

## Epic 1: Foundation & Authentication Infrastructure

Establish the foundational project infrastructure with Next.js 15, Hono.js integration, Better Auth implementation with all required plugins, database setup, and core architectural patterns. This epic delivers a working authentication system where invited users can log in with 2FA options and see role-appropriate landing pages, proving the technical stack works end-to-end.

### Story 1.1: Project Setup & Core Infrastructure

As a developer,  
I want to initialize the Next.js 15 project with Hono.js integration,  
so that we have a working foundation with API routing and deployment-ready structure.

#### Acceptance Criteria
1. Next.js 15 project initialized with App Router and TypeScript configuration
2. Hono.js installed and router.ts configured to handle API routes through Next.js
3. Docker configuration created for containerized deployment
4. Environment variable structure established for configuration management
5. Basic health check endpoint accessible at /api/health returning system status
6. Git repository initialized with proper .gitignore for Next.js projects
7. Development server runs successfully with hot reload working

### Story 1.2: Database Setup & Schema Design

As a developer,  
I want to configure PostgreSQL with Drizzle ORM and design the initial schema,  
so that we have a type-safe database layer ready for user and booking data.

#### Acceptance Criteria
1. PostgreSQL database connection established via Drizzle ORM
2. Initial schema created for users, organizations, teams, and sessions (Better Auth requirements)
3. Schema includes booking, document, and audit log table structures
4. Database migrations setup and initial migration executed successfully
5. Drizzle Studio configured for local database inspection
6. Connection pooling configured for production readiness

### Story 1.3: Better Auth Integration & Configuration

As a developer,  
I want to implement Better Auth with all required plugins,  
so that invited users can authenticate with multiple methods and proper role management.

#### Acceptance Criteria
1. Better Auth core configured with PostgreSQL adapter
2. Admin plugin enabled with 'user' and 'admin' roles configured
3. Organization plugin enabled with teams enabled and roles: owner, manager, team_lead, referrer, specialist
4. 2FA plugin configured supporting authenticator apps
5. Phone number plugin integrated for SMS-based auth (provider configured)
6. Email OTP plugin configured for email-based verification
7. Session management working with secure cookies
8. Auth middleware protecting API routes based on authentication status

### Story 1.4: User Invitation & Initial Login Flow

As an admin,  
I want to invite users to the platform with pre-assigned roles,  
so that only authorized users can access the system.

#### Acceptance Criteria
1. Admin API endpoint to create user accounts with email and assigned role
2. Invitation email sent with secure, time-limited activation link
3. First-time login flow allows password creation and optional 2FA setup
4. Login page supports email/password with "remember me" option
5. Phone number verification optional during first login
6. Successful login redirects to role-appropriate landing page
7. Password reset flow implemented with secure token generation
8. Expired invitation links show appropriate error message

### Story 1.5: Role-Based Landing Pages

As an authenticated user,  
I want to see a landing page with calendar and list views appropriate to my role,  
so that I can quickly access and view bookings relevant to me.

#### Acceptance Criteria
1. All users land on a dashboard showing both calendar view and list view of bookings
2. Admin users additionally see referrer search option (for impersonation) in the navigation
3. Referrer users see their own bookings and have access to create new bookings
4. Specialist users see only bookings assigned to them
5. Organization owners/managers see bookings for their entire organization/teams
6. Each booking in calendar/list views has a "View Details" button linking to detail page
7. Proper navigation menu adapts based on user role
8. Logout functionality clears session and returns to login page

## Epic 2: Booking Management Core

Implement the complete booking workflow that allows users to create, view, and manage IME bookings through Acuity integration. This epic delivers the core value proposition where referrers can self-serve booking creation, view bookings in calendar/list formats with filtering, and track detailed booking status throughout the examination lifecycle.

### Story 2.1: Acuity Integration & Specialist Configuration

As a developer,  
I want to integrate with Acuity Scheduling API and link specialists to the system,  
so that real-time availability and calendar management works seamlessly.

#### Acceptance Criteria
1. Acuity API client configured with proper authentication and error handling
2. Specialist users linked to Acuity calendars via calendarId mapping
3. API endpoints to fetch specialist availability for given date ranges
4. Webhook endpoints configured to receive booking updates from Acuity
5. Graceful handling of Acuity API downtime with appropriate user messaging
6. Calendar sync validates specialist exists in both systems
7. Test coverage for all Acuity integration points

### Story 2.2: Booking Creation Workflow

As a referrer,  
I want to create a new IME booking by selecting a specialist and time slot,  
so that I can schedule examinations without phone calls.

#### Acceptance Criteria
1. Multi-step booking form: specialist selection → available time slots → examinee details
2. Real-time availability fetched from Acuity when specialist selected
3. Time slots displayed in user's timezone with clear date/time formatting
4. Examinee information form captures all required fields for IME
5. Booking creation completes in under 3 minutes for experienced users
6. Success confirmation shows booking details and next steps
7. Failed bookings provide clear error messages and recovery options
8. Form progress saved locally to prevent data loss on navigation

### Story 2.3: Calendar View Implementation

As a user,  
I want to view bookings in a calendar format with filtering options,  
so that I can visualize the examination schedule effectively.

#### Acceptance Criteria
1. Monthly calendar view displays bookings as visual blocks
2. Status filter toggles between Active (scheduled/rescheduled/generating-report/report-generated) and Closed (no-show/cancelled/payment-received)
3. Specialist multi-select filter shows bookings for selected specialists only
4. Search input filters bookings by examinee name in real-time
5. Clicking a booking shows summary tooltip with "View Details" button
6. Calendar navigation allows moving between months smoothly
7. Empty states provide helpful messages when no bookings match filters
8. Responsive design adapts calendar for mobile viewing

### Story 2.4: List View with Advanced Filtering

As a user,  
I want to view bookings in a sortable list with the same filtering as calendar view,  
so that I can efficiently find and manage specific bookings.

#### Acceptance Criteria
1. Tabular list displays key booking information: date, time, examinee, specialist, status
2. Same three filters as calendar: status (Active/Closed), specialist multi-select, examinee search
3. Sortable columns for date, specialist name, and status
4. Pagination handles large booking sets efficiently (20 per page)
5. Each row has "View Details" button for navigation to detail page
6. Booking status badges use consistent colors across the application
7. Export functionality allows downloading filtered results as CSV
8. List performance remains fast with 1000+ bookings

### Story 2.5: Booking Detail Page & Status Management

As a user,  
I want to view complete booking details and update the booking status,  
so that I can track the examination progress accurately.

#### Acceptance Criteria
1. Detail page shows all booking information: specialist, examinee, date/time, status, progress
2. Status section shows current status (Active/Closed/Archived) with last update timestamp
3. Progress tracker displays current stage with user-attributed history
4. Authorized users can update progress stages (scheduled → rescheduled/cancelled/no-show → generating-report → report-generated → payment-received)
5. Status changes create audit log entries with user and timestamp
6. Related documents section shows uploaded files (prepare for Epic 3)
7. Booking modification requires appropriate role permissions
8. Mobile-responsive layout maintains usability on all devices

## Epic 3: Document Management System

Build a secure document management system that handles all IME-related documents with proper access control and compliance. This epic implements the two-stage workflow where bookings are created first, then documents are uploaded, ensuring all medical-legal documents are stored securely with portal-proxied access and role-based visibility.

### Story 3.1: S3 Integration & Security Configuration

As a developer,  
I want to configure AWS S3 with proper security settings for PHI storage,  
so that all documents are stored with HIPAA-compliant encryption and access controls.

#### Acceptance Criteria
1. S3 bucket created with server-side encryption (AES-256) enabled
2. Bucket policies prevent direct public access to any objects
3. IAM roles configured for application-only access to S3
4. Versioning enabled on bucket for document history
5. Lifecycle policies set for compliant document retention
6. CloudTrail logging enabled for all S3 access events
7. Pre-signed URL generation working for temporary access
8. Test files upload/download successfully through application

### Story 3.2: Document Upload Interface

As a user,  
I want to upload documents to a booking after it's created,  
so that all examination-related files are centrally stored.

#### Acceptance Criteria
1. Document upload section appears on booking detail page after booking creation
2. Drag-and-drop interface supports multiple file uploads
3. File type validation allows common formats (PDF, DOCX, images, audio for dictations)
4. Maximum file size of 100MB enforced with clear error messaging
5. Progress indicators show upload status for each file
6. Document categories available: consent forms, briefs, reports, dictations, other
7. Successful uploads immediately visible in document list
8. Upload errors provide specific guidance for resolution

### Story 3.3: Portal-Proxied Download System

As a developer,  
I want to implement secure document downloads through the application,  
so that all PHI access is validated and audited.

#### Acceptance Criteria
1. Download endpoint validates user permissions before generating S3 access
2. Portal proxy streams documents without exposing S3 URLs
3. Downloads work for all supported file types and sizes
4. Access attempts logged with user, document, timestamp, and outcome
5. Expired session redirects to login instead of showing errors
6. Download progress visible for large files
7. Proper Content-Type headers set for browser handling
8. Rate limiting prevents abuse of download endpoints

### Story 3.4: Document Categorization & Metadata

As a user,  
I want to categorize and manage uploaded documents,  
so that files are organized and easily retrievable.

#### Acceptance Criteria
1. Each document assigned a category during upload
2. Document list shows: filename, category, upload date, uploaded by
3. Filter documents by category within booking detail page
4. Sort documents by date, name, or category
5. Document rename functionality available to authorized users
6. Delete functionality with soft-delete for compliance
7. Dictation files clearly marked with audio icon
8. Document count badges show number per category

### Story 3.5: Role-Based Document Access

As a system administrator,  
I want documents to respect role-based permissions,  
so that users only see documents they're authorized to access.

#### Acceptance Criteria
1. Referrers see all documents for their own bookings
2. Specialists see documents only for assigned bookings
3. Organization owners/managers see documents for their organization
4. Team leads see documents for their team members' bookings
5. Admins see all documents when impersonating referrers
6. Document visibility rules clearly documented in help text
7. Unauthorized access attempts return 403 with appropriate message
8. Permission checks performed on both list and download operations

## Epic 4: Admin Impersonation & Audit Integration

Enable admin users to efficiently support phone-based referrers by implementing a search and impersonation system, while ensuring all actions are properly attributed and logged for compliance. This epic completes the MVP by allowing the existing phone-based workflow to continue while referrers transition to self-service.

### Story 4.1: Referrer Search Interface

As an admin user,  
I want to search for and find referrers quickly,  
so that I can assist them with booking creation over the phone.

#### Acceptance Criteria
1. Dedicated search interface accessible only to admin users
2. Search by referrer name, email, or organization with fuzzy matching
3. Search results show: referrer name, email, organization, last activity
4. Results load quickly even with 1000+ referrers in system
5. Keyboard navigation supported for efficiency (arrow keys, enter to select)
6. Recent referrers section shows last 10 impersonated users
7. Clear visual indication that this is admin-only functionality
8. Mobile-responsive design for admins working remotely

### Story 4.2: Impersonation Mechanism

As an admin user,  
I want to act as a specific referrer,  
so that I can create bookings on their behalf while maintaining attribution.

#### Acceptance Criteria
1. "Act as" button on each search result initiates impersonation
2. Clear banner shows "Acting as: [Referrer Name]" during impersonation
3. All actions performed are attributed to both admin and referrer
4. Navigation maintains impersonation state across pages
5. "Exit Impersonation" button prominently displayed at all times
6. Impersonation session timeout after 30 minutes of inactivity
7. Cannot impersonate other admin users for security
8. Browser refresh maintains impersonation state

### Story 4.3: Audit Logging Implementation

As a compliance officer,  
I want all user actions logged for external audit systems,  
so that we maintain complete records for legal and regulatory requirements.

#### Acceptance Criteria
1. Pino logger configured with structured JSON output
2. Every API endpoint logs: user ID, action, resource, timestamp, outcome
3. Impersonated actions log both admin ID and referrer ID
4. Document access logs include document ID and access type
5. Failed authentication attempts logged with appropriate detail
6. Logs exclude sensitive data (passwords, full PHI content)
7. Log rotation configured to prevent disk space issues
8. Logs formatted for easy ingestion by external audit systems

### Story 4.4: Impersonation Booking Flow

As an admin acting as a referrer,  
I want to create bookings with the same interface as referrers,  
so that I can provide consistent phone support.

#### Acceptance Criteria
1. Booking creation flow identical to referrer experience
2. Created bookings show "Created by: [Admin] on behalf of [Referrer]"
3. Booking appears in referrer's booking list immediately
4. Email confirmations sent to referrer, not admin
5. All booking actions available during impersonation
6. Document uploads attributed correctly to referrer
7. Validation rules apply based on referrer's permissions
8. Smooth transition between multiple impersonation sessions

### Story 4.5: Audit Trail Attribution

As a system administrator,  
I want clear attribution of all impersonated actions,  
so that we can distinguish between direct and assisted activities.

#### Acceptance Criteria
1. Database records include created_by and on_behalf_of fields
2. UI displays attribution for impersonated actions where relevant
3. Booking history shows both direct and assisted bookings
4. Export functions include attribution data
5. Audit logs clearly distinguish impersonated actions
6. Attribution preserved through all system updates
7. Reports can filter by direct vs impersonated actions
8. Attribution visible in all relevant UI components

## Checklist Results Report

### Executive Summary

- **Overall PRD Completeness:** 94%
- **MVP Scope Appropriateness:** Just Right
- **Readiness for Architecture Phase:** Ready
- **Most Critical Gaps:** Limited user research documentation, no competitive analysis, technical risk areas not explicitly flagged

### Category Analysis Table

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PARTIAL | Missing competitive analysis and detailed user research |
| 2. MVP Scope Definition          | PASS    | Well-defined scope with clear boundaries |
| 3. User Experience Requirements  | PASS    | Comprehensive UX requirements with accessibility |
| 4. Functional Requirements       | PASS    | Clear, testable requirements with good structure |
| 5. Non-Functional Requirements   | PASS    | Security, performance, and compliance well-addressed |
| 6. Epic & Story Structure        | PASS    | Logical progression with sized stories |
| 7. Technical Guidance            | PASS    | Clear technical stack and constraints |
| 8. Cross-Functional Requirements | PASS    | Integration and data requirements covered |
| 9. Clarity & Communication       | PASS    | Well-structured and clear documentation |

### Top Issues by Priority

**BLOCKERS:** None identified - PRD is ready for architecture phase

**HIGH:**
- No competitive analysis of existing IME booking platforms
- Limited documentation of user research methodology
- Technical risks (Acuity dependency, HIPAA compliance complexity) not explicitly flagged for architect attention

**MEDIUM:**
- Baseline metrics for current process could be more detailed
- Data retention policies mentioned but not specified
- Migration approach for existing bookings not addressed

**LOW:**
- Diagrams for user flows would enhance clarity
- Glossary for medical-legal terms would help new team members

### MVP Scope Assessment

**Scope Analysis:**
- The MVP is appropriately scoped with 4 focused epics
- Clear separation between MVP and post-MVP features
- Each epic delivers tangible value
- 6-week timeline is aggressive but achievable with the defined scope

**Features Appropriately Deferred:**
- Automated notifications (manual status checking is sufficient for MVP)
- Native booking system (Acuity dependency acceptable initially)
- Advanced analytics and dashboards
- Payment processing

**Essential Features Included:**
- Invite-only authentication with 2FA
- Core booking workflow with Acuity integration
- Secure document management with portal-proxy
- Admin impersonation for phone support continuity

### Technical Readiness

**Clarity of Technical Constraints:**
- Technology stack clearly defined (Next.js 15, Hono.js, Better Auth)
- HIPAA compliance requirements explicit
- Performance expectations quantified
- Integration points identified

**Identified Technical Risks:**
- Acuity API dependency is a single point of failure
- HIPAA compliance on bootstrap budget needs careful planning
- Portal-proxied downloads could become performance bottleneck

**Areas Needing Architect Investigation:**
- Optimal caching strategy for Acuity data
- Scalable approach for portal-proxied downloads
- Audit log storage and rotation strategy
- Better Auth organization plugin complexity with teams

### Recommendations

1. **Before Architecture Phase:**
   - Document known Acuity API limitations and fallback strategies
   - Create high-level data flow diagram for document access
   - Specify audit log retention period (e.g., 7 years for legal compliance)

2. **During Architecture Phase:**
   - Design for eventual Acuity replacement
   - Plan for horizontal scaling of portal-proxy service
   - Define disaster recovery approach for S3 documents

3. **For Product Success:**
   - Plan user onboarding strategy for invite-only model
   - Define success metrics for first 30/60/90 days post-launch
   - Create feedback collection mechanism for early users

### Final Decision

**READY FOR ARCHITECT**: The PRD and epics are comprehensive, properly structured, and ready for architectural design. While there are some areas that could be enhanced (competitive analysis, user research documentation), none of these gaps block the architecture phase. The technical requirements are clear, the scope is appropriate for MVP, and the epic structure provides a logical implementation path.

## Next Steps

### UX Expert Prompt
Please help create the UI/UX design for the Medical Examination Booking Platform using this PRD. Focus on the professional medical-legal aesthetic with #a2826c as the primary accent color, ensuring WCAG AA compliance, and designing the key screens: login, dashboard with calendar/list views, booking creation wizard, and admin impersonation interface. The design should prioritize efficiency for busy legal professionals while maintaining trust and compliance standards.

### Architect Prompt
Please create the technical architecture for the Medical Examination Booking Platform based on this PRD. Use Next.js 15 with App Router, integrate Hono.js via router.ts, implement Better Auth with all specified plugins (admin, organization with teams, 2FA, phone, email OTP), design the PostgreSQL schema with Drizzle ORM, and ensure HIPAA-compliant document storage using AWS S3 with portal-proxied downloads. Focus on creating a secure, scalable architecture that supports the invite-only authentication model and comprehensive audit logging.