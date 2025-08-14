# Wireframes & Mockups

**Primary Design Files:** This project will proceed directly to implementation without traditional design mockups. The UI will be built using Shadcn UI components with the defined color palette and design principles.

## Key Screen Layouts

### Dashboard with Calendar View

**Purpose:** Primary interface showing all bookings in a visual monthly calendar format with filtering capabilities

**Key Elements:**
- Top navigation bar with logo, "Create Booking" button, user menu, and admin tools (if applicable)
- Filter controls bar: Status toggle (Active/Closed), Specialist multi-select dropdown, Search input for examinee names
- Monthly calendar grid with day cells showing booking cards (time, examinee name, specialist initials)
- Calendar navigation (previous/next month, today button)
- View toggle to switch between Calendar and List views

**Interaction Notes:** Clicking any booking card opens a preview tooltip with basic info and "View Details" button. Empty calendar days show subtle "+" icon on hover for future quick booking feature. Filters apply instantly without page reload.

### Booking Creation Wizard - Specialist Selection

**Purpose:** First step of booking creation where users choose which medical specialist to book

**Key Elements:**
- Progress indicator showing 3 steps (Select Specialist → Choose Time → Enter Details)
- Search bar to filter specialists by name or specialty
- Specialist cards in a grid layout showing: name, specialty, location, next available slot
- Selected specialist highlighted with primary color (#8f693d) border
- "Continue" button (disabled until selection made)

**Interaction Notes:** Real-time search filters specialist list as user types. Specialist cards are clickable anywhere within bounds. Loading state shows skeleton cards while fetching availability.

### Booking Detail Page

**Purpose:** Comprehensive view of a single booking with all information and actions available

**Key Elements:**
- Breadcrumb navigation (Dashboard > Bookings > [Examinee Name])
- Header section: Examinee name, booking date/time, specialist name
- Status badge and progress tracker showing current stage
- Document management section with upload button and document list
- Activity timeline showing all status changes with timestamps and user attribution
- Action buttons based on user role (Update Status, Upload Documents, Cancel Booking)

**Interaction Notes:** Document section uses drag-and-drop with visual feedback. Status updates trigger confirmation modal. All actions immediately reflected in activity timeline.
