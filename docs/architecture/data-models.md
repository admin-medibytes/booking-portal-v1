# Data Models

## Specialist
**Purpose:** Medical specialists who conduct examinations, linked to Acuity calendars and Better Auth users

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- userId: string - Link to Better Auth user account
- acuityCalendarId: string - Acuity calendar identifier
- name: string - Professional name
- specialty: string - Medical specialty
- location: string | null - Practice location (null for telehealth-only specialists)
- isActive: boolean - Availability status

## TypeScript Interface
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

## Relationships
- References Better Auth user via userId
- Has many bookings

## Booking
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

## TypeScript Interface
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

## Relationships
- Belongs to one specialist
- References Better Auth organization via organizationId
- References Better Auth team via teamId (optional)
- References Better Auth users via createdById and createdForId
- Has many documents
- Has many booking progress entries
- Has many audit logs

## BookingProgress
**Purpose:** Tracks the history of progress changes for a booking with full attribution

**Key Attributes:**
- id: string (cuid2) - Unique identifier
- bookingId: string - Associated booking
- progress: 'scheduled' | 'rescheduled' | 'cancelled' | 'no_show' | 'generating_report' | 'report_generated' | 'payment_received' - Progress stage
- changedById: string - User who made the change (from Better Auth)
- changedForId: string | null - If change was made via impersonation
- notes: text | null - Optional notes about the progress change
- createdAt: timestamp - When the progress change occurred

## TypeScript Interface
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

## Relationships
- Belongs to one booking
- References Better Auth user via changedById
- References Better Auth user via changedForId (for impersonation)

## Document
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

## TypeScript Interface
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

## Relationships
- Belongs to one booking
- References Better Auth user via uploadedById
- Referenced in audit logs

## AuditLog
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

## TypeScript Interface
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

## Relationships
- References Better Auth users via userId and impersonatedUserId
- References various resource types (polymorphic)
