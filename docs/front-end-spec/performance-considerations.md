# Performance Considerations

## Performance Goals

- **Page Load:** Initial page load under 3 seconds on 4G connection, under 1.5 seconds on broadband
- **Interaction Response:** All user interactions respond within 100ms, async operations show loading state within 200ms
- **Animation FPS:** Maintain 60fps for all animations and scrolling, gracefully degrade on lower-end devices

## Design Strategies

1. **Progressive Loading** - Show skeleton screens immediately while data loads, prioritize above-fold content, lazy load images and heavy components
2. **Optimistic Updates** - Update UI immediately on user action, handle failures gracefully with rollback and clear messaging
3. **Smart Caching** - Cache specialist availability for 5 minutes, cache user preferences locally, invalidate strategically
4. **Minimize Layout Shifts** - Reserve space for dynamic content, specify image dimensions, avoid inserting content above existing elements
5. **Efficient Data Display** - Virtualize long lists (100+ items), paginate data tables (20 items default), use infinite scroll sparingly
6. **Asset Optimization** - Use WebP/AVIF for images with fallbacks, inline critical CSS, defer non-critical scripts, use font-display: swap
