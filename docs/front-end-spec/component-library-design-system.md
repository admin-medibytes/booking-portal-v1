# Component Library / Design System

**Design System Approach:** The platform will use Shadcn UI as the foundation component library, customized with the medical-legal professional aesthetic. Components will be configured with the #8f693d primary color and extended as needed for domain-specific requirements. No separate design system will be maintained - Shadcn UI's built-in consistency and accessibility features will ensure a cohesive experience.

## Core Components

### Button

**Purpose:** Primary interactive element for all user actions across the platform

**Variants:** Primary (filled #8f693d), Secondary (outline), Destructive (red for dangerous actions), Ghost (minimal for less important actions)

**States:** Default, Hover, Active, Disabled, Loading (with spinner)

**Usage Guidelines:** Primary buttons for main actions (Create Booking, Save), Secondary for alternative actions (Cancel, Back), Destructive only for irreversible actions with confirmation

### Form Input

**Purpose:** Text entry for all data collection needs

**Variants:** Default text input, Password (masked), Search (with icon), Textarea (multi-line)

**States:** Default, Focused, Error, Disabled, Read-only

**Usage Guidelines:** Always include clear labels, use placeholder text sparingly, show validation errors below field with red text, include helper text for complex requirements

### Select/Dropdown

**Purpose:** Allow users to choose from predefined options

**Variants:** Single select, Multi-select (for specialist filter), Searchable select (for long lists)

**States:** Default, Open, Selected, Disabled, Error

**Usage Guidelines:** Use for 5+ options (otherwise use radio buttons), include search for 10+ items, show selected count for multi-select, sort options logically (alphabetical or by frequency)

### Data Table

**Purpose:** Display booking lists and other tabular data

**Variants:** Basic table, Sortable columns, With row actions, With pagination

**States:** Default, Loading (skeleton rows), Empty, Error

**Usage Guidelines:** Include column headers with sort indicators, highlight rows on hover, use consistent date/time formatting, support responsive collapse on mobile

### Status Badge

**Purpose:** Communicate booking and document status at a glance

**Variants:** Active (green), Closed (gray), Archived (dark gray), Progress stages (various colors)

**States:** Default only (non-interactive)

**Usage Guidelines:** Use consistent colors across platform, include icon where helpful, keep text concise, position consistently in layouts
