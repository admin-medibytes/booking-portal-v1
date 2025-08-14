# User Interface Design Goals

## Overall UX Vision
A clean, professional interface that reflects the medical-legal context while prioritizing efficiency and clarity. The design should feel trustworthy and secure, with minimal cognitive load for busy legal professionals. Every interaction should reinforce the platform's reliability and compliance standards.

## Key Interaction Paradigms
- **Quick Actions First:** Most common tasks (create booking, upload documents) prominently accessible
- **Progressive Disclosure:** Show essential information upfront, details on demand
- **Status-Driven Navigation:** Visual indicators guide users through the booking workflow
- **Role-Aware Interface:** UI adapts based on user permissions (admin, referrer, specialist)
- **Transparent Logging:** All actions are logged to external audit system via Pino

## Core Screens and Views
- Login/Authentication Screen (with organization selection)
- Main Dashboard (role-specific landing page)
- Booking Creation Wizard (specialist selection → time slot → examinee details)
- Calendar View with filters:
  - Status filter: Active (status active + scheduled/rescheduled/generating-report/report-generated) or Closed (status closed/archived + no-show/cancelled/payment-received)
  - Specialist filter (multi-select, show all if none selected)
  - Search input (examinee-specific search)
- Bookings List View with same filtering options as Calendar View
- Booking Detail Page (comprehensive view with documents and status)
- Document Management Interface (upload/download with categories)
- Referrer Search & Impersonation Interface (admin only)

## Accessibility: WCAG AA
- High contrast ratios for text readability
- Keyboard navigation support for all interactions
- Screen reader compatibility for vision-impaired users
- Clear focus indicators and form labels

## Branding
Professional medical-legal aesthetic using #a2826c as the primary accent color (warm bronze/taupe). Supporting palette includes:
- Primary accent: #a2826c (buttons, links, active states)
- Neutral grays: #f7f5f3 (light backgrounds), #e8e5e1 (borders), #6b6560 (text)
- Status colors: muted greens for success, warm ambers for warnings
- Clean typography with high readability, conservative layout emphasizing trust and professionalism

## Target Device and Platforms: Web Responsive
- Primary: Desktop browsers for office use
- Secondary: Tablet/mobile for on-the-go access
- Responsive design ensuring functionality across all screen sizes
