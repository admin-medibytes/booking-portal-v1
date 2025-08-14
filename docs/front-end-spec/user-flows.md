# User Flows

## Booking Creation Flow

**User Goal:** Create a new IME booking quickly and accurately

**Entry Points:** 
- "Create Booking" button in primary navigation
- "New Booking" button on dashboard
- Quick action button on empty calendar slots (future enhancement)

**Success Criteria:** Booking confirmed with specialist and time slot reserved in under 3 minutes

### Flow Diagram

```mermaid
graph TD
    A[Dashboard] --> B[Click Create Booking]
    B --> C[Select Specialist Screen]
    C --> D{Specialist Selected?}
    D -->|Yes| E[Loading Available Times]
    D -->|No| C
    E --> F[Choose Time Slot Screen]
    F --> G{Time Slot Selected?}
    G -->|Yes| H[Enter Examinee Details]
    G -->|No| F
    H --> I{All Fields Valid?}
    I -->|Yes| J[Review & Confirm]
    I -->|No| K[Show Validation Errors]
    K --> H
    J --> L{Confirm Booking?}
    L -->|Yes| M[Create Booking via Acuity]
    L -->|No| H
    M --> N{Booking Successful?}
    N -->|Yes| O[Show Success & Booking Details]
    N -->|No| P[Show Error & Recovery Options]
    P --> Q{Retry?}
    Q -->|Yes| F
    Q -->|No| A
```

### Edge Cases & Error Handling:
- Specialist becomes unavailable between selection and confirmation - show alert and return to specialist selection
- Time slot taken by another user - refresh available times and prompt new selection
- Acuity API timeout - show retry option (user must re-enter data)
- Network disconnection - display error message and suggest checking connection
- Session timeout - redirect to login with return URL to booking creation start

**Notes:** No form data is preserved in browser storage for security compliance. Users must complete booking in one session.

## Document Upload Flow

**User Goal:** Upload examination-related documents to an existing booking

**Entry Points:**
- "Upload Documents" button on booking detail page
- "Add Documents" link in booking confirmation screen
- Document section within booking details

**Success Criteria:** Documents uploaded, categorized, and immediately accessible to authorized users

### Flow Diagram

```mermaid
graph TD
    A[Booking Detail Page] --> B[Click Upload Documents]
    B --> C[Document Upload Interface]
    C --> D{Files Selected?}
    D -->|No| C
    D -->|Yes| E[Validate File Types/Size]
    E --> F{Files Valid?}
    F -->|No| G[Show Validation Error]
    G --> C
    F -->|Yes| H[Select Document Category]
    H --> I[Begin Upload to S3]
    I --> J[Show Progress Bar]
    J --> K{Upload Complete?}
    K -->|No| L{Upload Failed?}
    L -->|Yes| M[Show Error & Retry Option]
    L -->|No| J
    M --> N{Retry?}
    N -->|Yes| I
    N -->|No| C
    K -->|Yes| O[Update Document List]
    O --> P[Show Success Message]
    P --> Q{More Documents?}
    Q -->|Yes| C
    Q -->|No| A
```

### Edge Cases & Error Handling:
- File too large (>500MB) - show error before upload starts with file size limit
- Unsupported file type - highlight invalid files with accepted formats list
- Network interruption during upload - show failure with option to retry
- Session expires during upload - complete current upload, then redirect to login
- Concurrent uploads - support multiple file uploads with individual progress bars
- Large file handling - show estimated time remaining for files over 100MB

**Notes:** Portal-proxy ensures all document access is validated. No direct S3 URLs are ever exposed to users. Large medical files up to 500MB are supported.

## Admin Impersonation Flow

**User Goal:** Admin staff quickly finds and acts as a referrer to create bookings on their behalf

**Entry Points:**
- "Referrer Search" in admin tools (primary navigation for admin users only)
- Quick search shortcut (Cmd/Ctrl + K for power users)

**Success Criteria:** Admin finds correct referrer and enters impersonation mode in under 30 seconds

### Flow Diagram

```mermaid
graph TD
    A[Admin Dashboard] --> B[Access Referrer Search]
    B --> C[Search Interface]
    C --> D[Type Referrer Name/Email]
    D --> E[Real-time Search Results]
    E --> F{Found Referrer?}
    F -->|No| G[Show No Results]
    G --> H[Refine Search]
    H --> D
    F -->|Yes| I[Display Referrer List]
    I --> J[Select Referrer]
    J --> K[Click Act As Button]
    K --> L[Enter Impersonation Mode]
    L --> M[Show Impersonation Banner]
    M --> N[Redirect to Dashboard]
    N --> O[Create Booking as Referrer]
    O --> P{Task Complete?}
    P -->|No| O
    P -->|Yes| Q[Exit Impersonation]
    Q --> R[Return to Admin View]
```

### Edge Cases & Error Handling:
- Multiple referrers with similar names - show organization and email to differentiate
- Referrer not found - suggest checking spelling or partial matches
- Session timeout during impersonation - maintain impersonation state after re-login
- Accidental impersonation - require confirmation click to prevent misclicks
- Concurrent admin sessions - each admin's impersonation is independent

**Notes:** All actions during impersonation are logged with both admin and referrer IDs. Clear visual indication prevents admins from forgetting they're in impersonation mode.
