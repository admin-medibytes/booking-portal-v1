# Information Architecture (IA)

## Site Map / Screen Inventory

```mermaid
graph TD
    A[Login/Auth] --> B[Dashboard]
    B --> B1[Calendar View]
    B --> B2[List View]
    B --> B3[Booking Details]
    
    B --> C[Create Booking]
    C --> C1[Select Specialist]
    C --> C2[Choose Time Slot]
    C --> C3[Enter Examinee Details]
    C --> C4[Confirmation]
    
    B --> D[Admin Tools]
    D --> D1[Referrer Search]
    D --> D2[Impersonation Mode]
    
    B --> E[User Menu]
    E --> E1[Profile]
    E --> E2[Organization Settings]
    E --> E3[Team Management]
    E --> E4[Logout]
    
    B3 --> F[Document Management]
    F --> F1[Upload Documents]
    F --> F2[View/Download Documents]
    F --> F3[Document Categories]
```

## Navigation Structure

**Primary Navigation:** Horizontal top bar with logo, main actions (Create Booking for referrers), user menu, and admin tools (for admin users only)

**Secondary Navigation:** Within dashboard views, toggle between Calendar and List views, with persistent filter controls (status, specialist, search)

**Breadcrumb Strategy:** Show hierarchical path on detail pages (Dashboard > Bookings > [Examinee Name]), with clickable segments for easy navigation back
