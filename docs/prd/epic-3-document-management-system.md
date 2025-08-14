# Epic 3: Document Management System

Build a secure document management system that handles all IME-related documents with proper access control and compliance. This epic implements the two-stage workflow where bookings are created first, then documents are uploaded, ensuring all medical-legal documents are stored securely with portal-proxied access and role-based visibility.

## Story 3.1: S3 Integration & Security Configuration

As a developer,  
I want to configure AWS S3 with proper security settings for PHI storage,  
so that all documents are stored with HIPAA-compliant encryption and access controls.

### Acceptance Criteria
1. S3 bucket created with server-side encryption (AES-256) enabled
2. Bucket policies prevent direct public access to any objects
3. IAM roles configured for application-only access to S3
4. Versioning enabled on bucket for document history
5. Lifecycle policies set for compliant document retention
6. CloudTrail logging enabled for all S3 access events
7. Pre-signed URL generation working for temporary access
8. Test files upload/download successfully through application

## Story 3.2: Document Upload Interface

As a user,  
I want to upload documents to a booking after it's created,  
so that all examination-related files are centrally stored.

### Acceptance Criteria
1. Document upload section appears on booking detail page after booking creation
2. Drag-and-drop interface supports multiple file uploads
3. File type validation allows common formats (PDF, DOCX, images, audio for dictations)
4. Maximum file size of 100MB enforced with clear error messaging
5. Progress indicators show upload status for each file
6. Document categories available: consent forms, briefs, reports, dictations, other
7. Successful uploads immediately visible in document list
8. Upload errors provide specific guidance for resolution

## Story 3.3: Portal-Proxied Download System

As a developer,  
I want to implement secure document downloads through the application,  
so that all PHI access is validated and audited.

### Acceptance Criteria
1. Download endpoint validates user permissions before generating S3 access
2. Portal proxy streams documents without exposing S3 URLs
3. Downloads work for all supported file types and sizes
4. Access attempts logged with user, document, timestamp, and outcome
5. Expired session redirects to login instead of showing errors
6. Download progress visible for large files
7. Proper Content-Type headers set for browser handling
8. Rate limiting prevents abuse of download endpoints

## Story 3.4: Document Categorization & Metadata

As a user,  
I want to categorize and manage uploaded documents,  
so that files are organized and easily retrievable.

### Acceptance Criteria
1. Each document assigned a category during upload
2. Document list shows: filename, category, upload date, uploaded by
3. Filter documents by category within booking detail page
4. Sort documents by date, name, or category
5. Document rename functionality available to authorized users
6. Delete functionality with soft-delete for compliance
7. Dictation files clearly marked with audio icon
8. Document count badges show number per category

## Story 3.5: Role-Based Document Access

As a system administrator,  
I want documents to respect role-based permissions,  
so that users only see documents they're authorized to access.

### Acceptance Criteria
1. Referrers see all documents for their own bookings
2. Specialists see documents only for assigned bookings
3. Organization owners/managers see documents for their organization
4. Team leads see documents for their team members' bookings
5. Admins see all documents when impersonating referrers
6. Document visibility rules clearly documented in help text
7. Unauthorized access attempts return 403 with appropriate message
8. Permission checks performed on both list and download operations
