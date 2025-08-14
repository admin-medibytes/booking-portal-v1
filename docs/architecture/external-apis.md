# External APIs

## Acuity Scheduling API
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

## AWS S3 API
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

## AWS SES (Simple Email Service)
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

## Future External APIs (Not Implemented Initially)
- **SMS Provider (Twilio/AWS SNS)** - For phone verification when SMS feature is enabled
- **Payment Gateway** - For processing examination payments (post-MVP)
- **Document Generation API** - For creating formatted reports from templates
