# Epic 4: Admin Impersonation & Audit Integration

Enable admin users to efficiently support phone-based referrers by implementing a search and impersonation system, while ensuring all actions are properly attributed and logged for compliance. This epic completes the MVP by allowing the existing phone-based workflow to continue while referrers transition to self-service.

## Story 4.1: Referrer Search Interface

As an admin user,  
I want to search for and find referrers quickly,  
so that I can assist them with booking creation over the phone.

### Acceptance Criteria
1. Dedicated search interface accessible only to admin users
2. Search by referrer name, email, or organization with fuzzy matching
3. Search results show: referrer name, email, organization, last activity
4. Results load quickly even with 1000+ referrers in system
5. Keyboard navigation supported for efficiency (arrow keys, enter to select)
6. Recent referrers section shows last 10 impersonated users
7. Clear visual indication that this is admin-only functionality
8. Mobile-responsive design for admins working remotely

## Story 4.2: Impersonation Mechanism

As an admin user,  
I want to act as a specific referrer,  
so that I can create bookings on their behalf while maintaining attribution.

### Acceptance Criteria
1. "Act as" button on each search result initiates impersonation
2. Clear banner shows "Acting as: [Referrer Name]" during impersonation
3. All actions performed are attributed to both admin and referrer
4. Navigation maintains impersonation state across pages
5. "Exit Impersonation" button prominently displayed at all times
6. Impersonation session timeout after 30 minutes of inactivity
7. Cannot impersonate other admin users for security
8. Browser refresh maintains impersonation state

## Story 4.3: Audit Logging Implementation

As a compliance officer,  
I want all user actions logged for external audit systems,  
so that we maintain complete records for legal and regulatory requirements.

### Acceptance Criteria
1. Pino logger configured with structured JSON output
2. Every API endpoint logs: user ID, action, resource, timestamp, outcome
3. Impersonated actions log both admin ID and referrer ID
4. Document access logs include document ID and access type
5. Failed authentication attempts logged with appropriate detail
6. Logs exclude sensitive data (passwords, full PHI content)
7. Log rotation configured to prevent disk space issues
8. Logs formatted for easy ingestion by external audit systems

## Story 4.4: Impersonation Booking Flow

As an admin acting as a referrer,  
I want to create bookings with the same interface as referrers,  
so that I can provide consistent phone support.

### Acceptance Criteria
1. Booking creation flow identical to referrer experience
2. Created bookings show "Created by: [Admin] on behalf of [Referrer]"
3. Booking appears in referrer's booking list immediately
4. Email confirmations sent to referrer, not admin
5. All booking actions available during impersonation
6. Document uploads attributed correctly to referrer
7. Validation rules apply based on referrer's permissions
8. Smooth transition between multiple impersonation sessions

## Story 4.5: Audit Trail Attribution

As a system administrator,  
I want clear attribution of all impersonated actions,  
so that we can distinguish between direct and assisted activities.

### Acceptance Criteria
1. Database records include created_by and on_behalf_of fields
2. UI displays attribution for impersonated actions where relevant
3. Booking history shows both direct and assisted bookings
4. Export functions include attribution data
5. Audit logs clearly distinguish impersonated actions
6. Attribution preserved through all system updates
7. Reports can filter by direct vs impersonated actions
8. Attribution visible in all relevant UI components
