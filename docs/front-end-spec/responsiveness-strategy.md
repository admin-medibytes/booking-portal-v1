# Responsiveness Strategy

## Breakpoints

| Breakpoint | Min Width | Max Width | Target Devices |
|------------|-----------|-----------|----------------|
| Mobile | 320px | 767px | Smartphones, small tablets |
| Tablet | 768px | 1023px | iPads, tablets, small laptops |
| Desktop | 1024px | 1439px | Laptops, standard monitors |
| Wide | 1440px | - | Large monitors, ultra-wide displays |

## Adaptation Patterns

**Layout Changes:** 
- Mobile: Single column layouts, stacked navigation, full-width components
- Tablet: Two-column layouts where appropriate, condensed navigation
- Desktop: Full multi-column layouts, side-by-side panels, expanded navigation
- Wide: Centered content with max-width containers, additional sidebar information

**Navigation Changes:**
- Mobile: Hamburger menu, bottom sheet for filters, simplified top bar
- Tablet: Collapsible sidebar, dropdown navigation, persistent filter bar
- Desktop+: Full horizontal navigation, always-visible filters, quick actions

**Content Priority:**
- Mobile: Essential information only, progressive disclosure via accordions, hide table columns
- Tablet: Show more table columns, expand some collapsed sections
- Desktop+: All information visible, full data tables, expanded details

**Interaction Changes:**
- Mobile: Touch-optimized with larger targets, swipe gestures for navigation, bottom sheets for modals
- Tablet: Mixed touch/mouse optimization, hover states on capable devices
- Desktop+: Full hover interactions, keyboard shortcuts enabled, right-click context menus
