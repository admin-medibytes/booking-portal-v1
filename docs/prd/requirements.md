# Requirements

## Functional
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

## Non Functional
- NFR1: All pages shall load within 2 seconds on standard broadband connections
- NFR2: The platform shall support 100+ concurrent users without performance degradation
- NFR3: All PHI data shall be encrypted in transit (TLS 1.2+) and at rest (AES-256)
- NFR4: The system shall maintain 99.9% uptime excluding planned maintenance windows
- NFR5: File uploads shall support documents up to 100MB for medical records
- NFR6: The system shall pass HIPAA and Privacy Act 1988/APPs compliance audits
- NFR7: All user actions on PHI shall be logged with comprehensive audit trails using Pino
- NFR8: The system shall prevent direct S3 access to documents (portal-proxy only)
