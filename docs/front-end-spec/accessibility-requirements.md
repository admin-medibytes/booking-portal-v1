# Accessibility Requirements

## Compliance Target

**Standard:** WCAG 2.1 Level AA compliance as the minimum baseline, with selected AAA criteria where feasible for critical user flows

## Key Requirements

**Visual:**
- Color contrast ratios: Minimum 4.5:1 for normal text, 3:1 for large text (18pt+), 3:1 for UI components
- Focus indicators: Visible keyboard focus with 2px outline using primary color (#8f693d) or sufficient contrast
- Text sizing: Base font 16px minimum, support browser zoom to 200% without horizontal scrolling

**Interaction:**
- Keyboard navigation: All interactive elements accessible via keyboard, logical tab order, skip links for main content
- Screen reader support: Semantic HTML, ARIA labels for icons, live regions for dynamic updates, form associations
- Touch targets: Minimum 44x44px for all clickable elements, adequate spacing between targets

**Content:**
- Alternative text: Descriptive alt text for all informative images, empty alt for decorative images
- Heading structure: Logical H1-H6 hierarchy, one H1 per page, no skipped levels
- Form labels: Every input has associated label, required fields marked with text (not just color), error messages linked to fields

## Testing Strategy

Regular accessibility audits using automated tools (axe DevTools) combined with manual keyboard navigation testing and screen reader testing with NVDA/JAWS. Include users with disabilities in user testing sessions when possible. Document and prioritize fixing any accessibility issues found.
