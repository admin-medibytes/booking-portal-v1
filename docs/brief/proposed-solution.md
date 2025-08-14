# Proposed Solution

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
