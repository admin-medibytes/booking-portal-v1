# Animation & Micro-interactions

## Motion Principles

1. **Purpose over polish** - Every animation serves a functional purpose: provide feedback, guide attention, or maintain context
2. **Snappy and responsive** - Keep durations short (200-300ms) for immediate feel, longer (400-500ms) only for major transitions
3. **Consistent easing** - Use ease-out for entrances, ease-in for exits, ease-in-out for movements
4. **Respect preferences** - Honor prefers-reduced-motion for users with motion sensitivity
5. **Performance first** - Prefer CSS transforms over layout changes, use GPU-accelerated properties

## Key Animations

- **Page Transitions:** Subtle fade between routes (Duration: 200ms, Easing: ease-out)
- **Modal/Dialog Entry:** Fade backdrop + scale-up content from 95% to 100% (Duration: 200ms, Easing: ease-out)
- **Dropdown Menus:** Slide down with slight fade (Duration: 150ms, Easing: ease-out)
- **Button Hover:** Background color transition (Duration: 150ms, Easing: ease)
- **Loading States:** Skeleton screens with shimmer effect (Duration: 1.5s, Easing: linear, infinite)
- **Form Validation:** Error messages slide down below fields (Duration: 200ms, Easing: ease-out)
- **Status Changes:** Brief highlight flash when booking status updates (Duration: 300ms, Easing: ease-in-out)
- **Drag & Drop:** Subtle scale on drag start, smooth position updates (Duration: immediate response, Easing: none)
- **Progress Indicators:** Smooth width transitions for progress bars (Duration: 300ms, Easing: ease-in-out)
- **Toast Notifications:** Slide in from top-right corner (Duration: 300ms, Easing: ease-out)
