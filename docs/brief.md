# Project Brief: Medical Examination Booking Platform

*Document created: 2025-08-11*
*Status: In Progress*

## Executive Summary

**Medical Examination Booking Platform** is a HIPAA-compliant and Privacy Act 1988/Australian Privacy Principles (APPs) compliant web application that streamlines the Independent Medical Examination (IME) referral process for Australian legal firms. The platform addresses the regulatory requirement where law firms cannot directly engage medical specialists for IMEs, instead having to work through approved intermediary services that coordinate these examinations.

**Primary Problem:** In Australia's personal injury legal system, law firms are required to use intermediary services to book Independent Medical Examinations with specialists. This creates inefficiencies through manual phone-based coordination, limited visibility into booking status, and dependency on third-party scheduling systems that weren't designed for the specific needs of legal-medical examination workflows.

**Target Market:** Australian law firms handling personal injury and workers' compensation cases, IME coordination services acting as intermediaries, medical specialists conducting independent examinations, and administrative staff managing the examination workflow.

**Key Value Proposition:** A purpose-built platform that digitizes the IME booking process, reducing coordination time by 80%, ensuring HIPAA and Privacy Act 1988/APPs compliance for sensitive medical-legal documents, providing real-time visibility across all stakeholders, and streamlining report generation by enabling specialists to dictate findings while admins handle report writing.

## Problem Statement

**Current State:** Law firms requiring Independent Medical Examinations must work through intermediary coordination services, creating a multi-layered, inefficient process. Referrers (lawyers) currently call administrative staff who manually create bookings on their behalf using disparate systems. This results in:

- **Time Inefficiency:** Each booking requires 15-20 minutes of phone coordination between lawyers and admins
- **Limited Visibility:** Referrers have no real-time access to booking status, requiring follow-up calls for updates
- **Document Fragmentation:** Medical-legal documents are scattered across email, fax, and various third-party systems
- **Scheduling Complexity:** Coordinating between lawyer availability, specialist schedules, and examinee needs through manual methods
- **Compliance Risks:** Handling sensitive PHI through non-secure channels like email poses HIPAA/Privacy Act 1988/APPs violations

**Impact Quantification:**
- With 50+ active referrers and ~90 bookings/month, the current system wastes approximately 27 hours of staff time monthly on booking coordination alone
- Missed appointments and rescheduling issues occur in 15% of cases due to communication gaps
- Document retrieval for completed examinations takes an average of 30 minutes per case
- Administrative burden prevents scaling beyond current volume without proportional staff increases

**Why Existing Solutions Fall Short:**
- **Generic scheduling tools** (like Calendly) lack the multi-party coordination required for IMEs
- **Medical appointment systems** don't account for legal documentation requirements and chain of custody
- **Current dependency on Acuity** provides basic scheduling but lacks integrated document management, role-based access, and examination workflow tracking
- **Email/phone coordination** creates no audit trail for compliance and offers no systematic workflow

**Urgency:** As the business grows and regulatory scrutiny on medical-legal documentation increases, the manual process becomes unsustainable. The platform must launch within 6 weeks to handle increasing case volume and maintain competitive advantage in the IME coordination market.

## Proposed Solution

**Core Concept:** A secure, role-based web portal that digitizes the entire IME workflow - from initial booking through final report delivery. The platform serves as the central hub where all stakeholders (referrers, specialists, admins) can efficiently manage examinations with appropriate visibility and permissions.

**Solution Approach:**
- **Direct Booking Interface:** Referrers can create bookings directly through the portal, selecting from available specialists and time slots via Acuity integration
- **Unified Document Repository:** All examination-related documents (consent forms, briefs, reports) are securely stored and accessed through the platform with portal-proxied downloads
- **Status & Progress Tracking:** 
  - Booking statuses: Active, Closed, Archived
  - Detailed progress tracking with timestamps and user attribution: Scheduled → Rescheduled/Cancelled/No-show → Generating Report → Report Generated → Payment Received
- **Workflow Automation:** Two-stage process where bookings are created first, then documents are uploaded, ensuring proper case setup
- **Role-based Access Control:** Leveraging Better Auth with two plugin types:
  - Admin plugin roles (system-wide): 'user' (access own data only) and 'admin' (internal team with referrer impersonation)
  - Organization plugin roles: 'owner' (full CRUD in org/teams), 'manager' (CRU in org/teams), 'team_lead' (CRU in team only), 'referrer' (CRU own data only), 'specialist' (CRU assigned data only)
  - Admin impersonation: Admins can "act as" any specific referrer to create bookings on their behalf, with clear UI indication showing "Acting as: [Referrer Name]" and full audit trails

**Key Differentiators:**
- **Purpose-built for IME workflows** rather than generic medical appointments - understands the lawyer→admin→specialist→report flow
- **Security-first architecture** with portal-proxied document access, preventing direct S3 exposure and ensuring access validation on every download
- **Document categorization** including dictation as a document type, allowing specialists to upload voice recordings as part of the examination documentation
- **Multi-tenancy support** where organizations and teams can manage their own booking workflows while maintaining data isolation

**Why This Solution Succeeds:**
- **Eliminates phone tag** by providing 24/7 self-service booking access to referrers
- **Creates accountability** through comprehensive audit trails required for legal proceedings
- **Scales efficiently** as new referrers can be onboarded without additional admin overhead
- **Future-ready architecture** designed to eventually replace Acuity with native booking functionality

**Vision:** Transform IME coordination from a manual bottleneck into a competitive advantage, positioning the intermediary service as the most efficient option for law firms requiring medical examinations.

## Target Users

### Primary User Segment: Referrers (Lawyers)

**Profile:**
- Personal injury and workers' compensation lawyers at Australian law firms
- Typically handling 5-20 active cases requiring IMEs at any given time
- Tech-savvy enough to use web portals but prefer simple, efficient interfaces
- Work in fast-paced environments with multiple competing priorities

**Current Behaviors:**
- Call admin staff multiple times per week to schedule examinations
- Email documents back and forth with risk of PHI exposure
- Manually track examination status in their own case management systems
- Follow up repeatedly to check on report completion

**Specific Needs:**
- Quick booking creation without phone calls (under 3 minutes)
- Visibility into specialist availability and examination status
- Secure document upload that maintains chain of custody
- Automated notifications when reports are ready
- Historical access to all their referrals for case documentation

**Goals:**
- Minimize time spent on administrative coordination
- Ensure examinations happen on schedule for case timelines
- Maintain compliance with medical privacy regulations
- Access examination reports quickly for case preparation

### Secondary User Segment: Specialists (Doctors)

**Profile:**
- Medical professionals qualified to conduct IMEs
- See multiple examinees per day across different referral sources
- Value efficiency and clear information presentation
- Often work across multiple locations or via telehealth

**Current Behaviors:**
- Receive appointment details through various channels (email, phone, fax)
- Review brief documents from multiple sources before examinations
- Dictate findings after examinations for admin transcription
- Limited involvement in report writing process

**Specific Needs:**
- Consolidated view of daily/weekly examination schedule
- Easy access to examinee information and case briefs
- Simple dictation upload process post-examination
- Clear understanding of what each examination requires
- Minimal administrative burden

**Goals:**
- Maximize time spent on examinations vs administration
- Access all relevant information in one place
- Complete examination workflow efficiently
- Maintain professional standards and compliance

## Goals & Success Metrics

### Business Objectives
- **Reduce booking creation time by 80%** - from 15-20 minutes via phone to under 3 minutes via portal (Q1 2025)
- **Achieve 95% referrer self-service adoption** - measured by bookings created directly vs through admin assistance (Q2 2025)
- **Handle 150+ bookings/month** without additional admin staff - 67% increase from current 90/month capacity (Q2 2025)
- **Decrease examination rescheduling rate to under 5%** - from current 15% through better coordination and visibility (Q1 2025)
- **Generate $50K+ annual revenue** from platform efficiency gains and increased booking capacity (Year 1)

### User Success Metrics
- **Referrer time-to-book under 3 minutes** for 90% of bookings - measured from login to booking confirmation
- **Specialist report turnaround within 48 hours** of examination - enabled by streamlined dictation workflow
- **Document retrieval in under 30 seconds** - from any historical examination via centralized repository
- **Zero PHI exposure incidents** - all documents transferred through secure portal channels only
- **User satisfaction score above 4.5/5** - measured quarterly through in-app surveys

### Key Performance Indicators (KPIs)
- **Platform Uptime:** 99.9% availability excluding planned maintenance windows
- **Booking Completion Rate:** Percentage of started bookings that are successfully submitted (target: >95%)
- **Active User Ratio:** Monthly active users / total registered users (target: >80%)
- **Document Upload Compliance:** Percentage of bookings with all required documents uploaded before examination (target: >98%)
- **Support Ticket Volume:** Average tickets per 100 bookings (target: <5, indicating intuitive UX)
- **Page Load Performance:** All pages load in under 2 seconds on standard broadband
- **Security Audit Score:** Pass all quarterly HIPAA compliance audits with zero critical findings

## MVP Scope

### Core Features (Must Have)

- **Authentication & Authorization System:** Complete Better Auth implementation with admin and organization plugins:
  - Admin plugin roles: 'user' (access own data) and 'admin' (internal team with referrer impersonation)
  - Organization plugin roles: 'owner' (full CRUD), 'manager' (CRU in org/teams), 'team_lead' (CRU in team), 'referrer' (CRU own data), 'specialist' (CRU assigned data)
  - Admin impersonation: Smart search interface allowing admins to quickly find and "act as" specific referrers when taking phone calls
- **User & Role Management:** Link specialists to users with calendarId mapping, support for multiple roles per user (except specialists), smart search interface for admin referrer impersonation (fetching users with 'referrer' role from organization members)
- **Booking Creation Flow:** Direct integration with Acuity Scheduling allowing referrers to select specialists, choose available time slots, and create bookings with examinee information auto-populated from forms
- **Three Booking Views:** Calendar view for visual scheduling, List view with status filters (Active/Closed/Archived), and detailed booking pages showing all related information
- **Status & Progress Tracking System:** 
  - Three booking statuses: Active, Closed, Archived
  - Detailed progress tracking with timestamps and user attribution: Scheduled → Rescheduled/Cancelled/No-show → Generating Report → Report Generated → Payment Received
- **Document Management:** Two-stage workflow (booking first, then documents), secure file upload for various document categories including consent forms, briefs, and dictations, portal-proxied downloads with access validation, role-based document visibility
- **Basic Reporting Workflow:** Document upload capabilities for all users based on their roles, including dictation recordings as a document category, support for draft and final reports, document versioning for iterations

### Out of Scope for MVP
- Native booking system (continuing with Acuity dependency)
- AI-powered report generation from dictations
- Specialist ranking/rating system
- Mobile native applications
- Advanced analytics and reporting dashboards
- Automated email/SMS notifications (manual status checking only)
- Payment processing integration
- Examinee portal access
- Bulk operations (bulk booking, bulk document upload)
- API for third-party integrations
- Advanced search and filtering beyond basic status
- Custom branding per organization

### MVP Success Criteria

**Functional Success:**
- Referrers can create bookings in under 3 minutes without admin assistance
- All three user views (calendar, list, detail) display accurate booking information
- Documents can be uploaded and downloaded securely with proper access control
- Status progression accurately reflects real-world examination workflow
- Role-based permissions prevent unauthorized access to bookings/documents

**Technical Success:**
- Platform handles 100+ concurrent users without performance degradation
- All PHI data is encrypted in transit and at rest
- System passes basic HIPAA compliance audit
- Zero critical security vulnerabilities in initial penetration testing
- 99% uptime during first month of production use

**Business Success:**
- 30+ referrers successfully onboarded and creating bookings
- 500+ bookings created through the platform in first month
- 90% reduction in admin time spent on booking coordination
- Positive feedback from at least 80% of active users

## Post-MVP Vision

### Phase 2 Features (3-6 months post-launch)

**Enhanced User Experience:**
- Automated email/SMS notifications for booking confirmations, status changes, and report availability
- Advanced search and filtering capabilities (by date range, specialist, referrer, examination type)
- Bulk operations for efficiency (bulk document upload, bulk status updates)
- Mobile-optimized progressive web app with offline capabilities
- Dashboard analytics for each user role showing relevant KPIs

**Workflow Automation:**
- AI-powered report generation from specialist dictations using medical NLP
- Automated reminder system for pending document uploads and overdue reports
- Smart scheduling suggestions based on specialist availability and location
- Integration with popular legal case management systems
- Webhook/API system for third-party integrations

**Platform Enhancements:**
- Custom branding and white-labeling per organization
- Multi-language support for diverse user base
- Advanced permission templates for complex organizational structures
- Audit trail export for compliance reporting

### Long-term Vision (6-12 months)

**Native Booking System:**
- Replace Acuity dependency with purpose-built scheduling engine
- Intelligent appointment routing based on specialist expertise and availability
- Automated conflict detection and resolution
- Support for complex booking rules (minimum notice periods, blackout dates)

**AI-Driven Intelligence:**
- Predictive analytics for no-show risk and automated mitigation
- Specialist performance metrics and automated matching
- Natural language processing for document analysis and summarization
- Chatbot for common user queries and booking assistance

**Ecosystem Expansion:**
- Marketplace for verified IME specialists to join the platform
- Integration hub connecting to EMR systems, legal software, and payment processors
- Mobile applications for iOS and Android with native features
- Telehealth integration for remote examinations

### Expansion Opportunities

**Geographic Scaling:**
- Adapt platform for other Australian states with different IME regulations
- Expand to New Zealand market with similar legal structure
- Create configurable compliance modules for different jurisdictions

**Service Extensions:**
- Add support for other medical-legal services (expert witnesses, case reviews)
- Incorporate billing and payment processing for complete financial workflow
- Develop training and certification modules for IME specialists

**Platform Evolution:**
- Become the industry standard for medical-legal examination coordination
- Create data insights product leveraging anonymized examination trends
- Build network effects through specialist ratings and referrer preferences
- Position for acquisition by larger legal tech or healthcare platform

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Modern web browsers (Chrome, Firefox, Safari, Edge) with responsive design for desktop and mobile devices
- **Browser/OS Support:** Latest two versions of major browsers, iOS 14+ and Android 10+ for mobile web access
- **Performance Requirements:** 
  - Page load under 2 seconds on 4G mobile connections
  - Support 100+ concurrent users without degradation
  - File uploads up to 100MB for medical documents
  - Real-time calendar updates without page refresh

### Technology Preferences

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

### Architecture Considerations

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

## Constraints & Assumptions

### Constraints

- **Budget:** Limited bootstrap budget requiring careful AWS service selection, minimal external services beyond essentials, need to optimize for operational efficiency while maintaining compliance
- **Timeline:** 6-week hard deadline for MVP launch to capture market opportunity, 4 weeks development + 1 week testing + 1 week deployment, no room for scope creep or major pivots
- **Resources:** Single developer/small team for initial build, limited time for extensive user research pre-launch, must leverage existing tools (Acuity, Better Auth) vs building from scratch
- **Technical:** 
  - Dependency on Acuity Scheduling API for MVP
  - AWS infrastructure costs need careful management and monitoring
  - HIPAA and Privacy Act 1988/APPs compliance requirements constraining architecture choices
  - Must work within existing Better Auth plugin capabilities

### Key Assumptions

- Acuity Scheduling will remain stable and available throughout MVP phase
- 50+ existing referrers will adopt the new platform with minimal training
- Current manual process pain is sufficient to drive user adoption
- Better Auth's organization plugin can handle the complex role hierarchy
- AWS S3 provides secure document storage with proper access controls
- AWS infrastructure can handle the deployment complexity of a HIPAA and Privacy Act 1988/APPs compliant application
- Users have modern browsers and stable internet connections
- The two-stage workflow (booking then documents) matches actual user behavior
- Specialists will embrace the dictation workflow for report generation
- HIPAA compliance can be achieved with chosen infrastructure

## Risks & Open Questions

### Key Risks

- **Acuity API Dependency:** Single point of failure if Acuity has outages or changes their API, limiting control over core booking functionality
- **HIPAA and Privacy Act 1988/APPs Compliance on Bootstrap Budget:** AWS compliance features may increase operational costs, need to balance security requirements with budget constraints
- **User Adoption Resistance:** Lawyers comfortable with current phone-based process may resist change, specialists might not embrace the dictation workflow
- **Scope Creep Under Tight Timeline:** Stakeholders requesting "just one more feature" could derail 6-week deadline, pressure to add notifications/payments early
- **Dual Role System Complexity:** Managing both Better Auth admin plugin (system-wide) and organization plugin (org-specific) roles simultaneously, but mitigated by clear separation: admins for internal team only, organization roles for all client users
- **Document Security at Scale:** Portal-proxied downloads could become bottleneck with growth, balance between security and user experience

### Open Questions

- What specific Australian privacy laws beyond HIPAA need to be considered?
- How will the system handle time zones for multi-state operations?
- What's the disaster recovery plan for document storage?
- Should we implement rate limiting for API endpoints from day one?
- How do we handle specialist unavailability or last-minute cancellations?
- What level of audit logging is required for legal compliance?
- Will Dokploy's deployment model support zero-downtime updates?
- How do we validate HIPAA compliance without expensive certification?

### Areas Needing Further Research

- Australian IME regulatory requirements by state
- Competitive analysis of existing IME coordination platforms
- Integration capabilities of popular legal case management systems
- Performance benchmarks for Better Auth with complex organizations
- Best practices for medical document retention policies
- Accessibility requirements for Australian government contracts
- Cost analysis of scaling beyond 150 bookings/month
- User research on optimal workflow for different referrer types

## Next Steps

### Immediate Actions

1. **Set up development environment with core stack** - Install Next.js, Hono.js, PostgreSQL, and configure Better Auth with required plugins
2. **Create Acuity Scheduling developer account** - Obtain API credentials and test integration capabilities with specialist calendars
3. **Configure AWS infrastructure** - Set up EC2 instances, S3 bucket with encryption for PHI documents, RDS for PostgreSQL, and configure ECS/EKS for container orchestration
4. **Design database schema** - Model users, organizations, teams, bookings, documents with proper relationships and constraints
5. **Implement authentication foundation** - Better Auth setup with admin/organization plugins and role-based permissions
6. **Create UI component library** - Set up Shadcn UI with custom theme matching medical-legal professional aesthetic
7. **Build booking creation flow** - Integrate with Acuity API for specialist selection and appointment scheduling
8. **Develop document management system** - Implement secure upload/download with portal-proxied access validation
9. **Schedule weekly stakeholder reviews** - Ensure alignment and gather feedback throughout development sprint

### PM Handoff

This Project Brief provides the full context for the Medical Examination Booking Platform. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.

The platform addresses the critical need for efficient IME coordination in the Australian legal market, with a clear path from MVP to market leadership. The chosen technology stack balances development speed with long-term scalability, while the phased approach ensures quick market entry with room for innovation.

Key success factors include maintaining scope discipline for the 6-week timeline, early user onboarding for feedback, and establishing security/compliance foundations from day one.