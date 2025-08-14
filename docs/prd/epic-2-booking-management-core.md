# Epic 2: Booking Management Core

Implement the complete booking workflow that allows users to create, view, and manage IME bookings through Acuity integration. This epic delivers the core value proposition where referrers can self-serve booking creation, view bookings in calendar/list formats with filtering, and track detailed booking status throughout the examination lifecycle.

## Story 2.1: Acuity Integration & Specialist Configuration

As a developer,  
I want to integrate with Acuity Scheduling API and link specialists to the system,  
so that real-time availability and calendar management works seamlessly.

### Acceptance Criteria
1. Acuity API client configured with proper authentication and error handling
2. Specialist users linked to Acuity calendars via calendarId mapping
3. API endpoints to fetch specialist availability for given date ranges
4. Webhook endpoints configured to receive booking updates from Acuity
5. Graceful handling of Acuity API downtime with appropriate user messaging
6. Calendar sync validates specialist exists in both systems
7. Test coverage for all Acuity integration points

## Story 2.2: Booking Creation Workflow

As a referrer,  
I want to create a new IME booking by selecting a specialist and time slot,  
so that I can schedule examinations without phone calls.

### Acceptance Criteria
1. Multi-step booking form: specialist selection → available time slots → examinee details
2. Real-time availability fetched from Acuity when specialist selected
3. Time slots displayed in user's timezone with clear date/time formatting
4. Examinee information form captures all required fields for IME
5. Booking creation completes in under 3 minutes for experienced users
6. Success confirmation shows booking details and next steps
7. Failed bookings provide clear error messages and recovery options
8. Form progress saved locally to prevent data loss on navigation

## Story 2.3: Calendar View Implementation

As a user,  
I want to view bookings in a calendar format with filtering options,  
so that I can visualize the examination schedule effectively.

### Acceptance Criteria
1. Monthly calendar view displays bookings as visual blocks
2. Status filter toggles between Active (scheduled/rescheduled/generating-report/report-generated) and Closed (no-show/cancelled/payment-received)
3. Specialist multi-select filter shows bookings for selected specialists only
4. Search input filters bookings by examinee name in real-time
5. Clicking a booking shows summary tooltip with "View Details" button
6. Calendar navigation allows moving between months smoothly
7. Empty states provide helpful messages when no bookings match filters
8. Responsive design adapts calendar for mobile viewing

## Story 2.4: List View with Advanced Filtering

As a user,  
I want to view bookings in a sortable list with the same filtering as calendar view,  
so that I can efficiently find and manage specific bookings.

### Acceptance Criteria
1. Tabular list displays key booking information: date, time, examinee, specialist, status
2. Same three filters as calendar: status (Active/Closed), specialist multi-select, examinee search
3. Sortable columns for date, specialist name, and status
4. Pagination handles large booking sets efficiently (20 per page)
5. Each row has "View Details" button for navigation to detail page
6. Booking status badges use consistent colors across the application
7. Export functionality allows downloading filtered results as CSV
8. List performance remains fast with 1000+ bookings

## Story 2.5: Booking Detail Page & Status Management

As a user,  
I want to view complete booking details and update the booking status,  
so that I can track the examination progress accurately.

### Acceptance Criteria
1. Detail page shows all booking information: specialist, examinee, date/time, status, progress
2. Status section shows current status (Active/Closed/Archived) with last update timestamp
3. Progress tracker displays current stage with user-attributed history
4. Authorized users can update progress stages (scheduled → rescheduled/cancelled/no-show → generating-report → report-generated → payment-received)
5. Status changes create audit log entries with user and timestamp
6. Related documents section shows uploaded files (prepare for Epic 3)
7. Booking modification requires appropriate role permissions
8. Mobile-responsive layout maintains usability on all devices
