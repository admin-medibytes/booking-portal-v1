# MVP Scope

## Core Features (Must Have)

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

## Out of Scope for MVP
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

## MVP Success Criteria

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
