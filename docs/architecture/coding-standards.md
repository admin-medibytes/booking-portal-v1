# Coding Standards

## Critical Fullstack Rules
- **Type Sharing:** Always define types in `types/` directory and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer with api-client
- **Environment Variables:** Access only through validated env object from @t3-oss/env-nextjs
- **Error Handling:** All API routes must use the standard error handler middleware
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Document Access:** Always use portal-proxy - never expose S3 URLs
- **Audit Logging:** Every state change must be logged via audit service
- **Validation:** Use ArkType for ALL input validation - no exceptions
- **Authentication:** Check permissions at the service layer, not just middleware
- **Database Access:** Only through repositories - no direct Drizzle queries in services

## Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `BookingCard.tsx` |
| Hooks | camelCase with 'use' | - | `useBookings.ts` |
| API Routes | - | kebab-case | `/api/booking-progress` |
| Database Tables | - | snake_case | `booking_progress` |
| Services | - | camelCase | `bookingService.ts` |
| Types/Interfaces | PascalCase | PascalCase | `BookingFormData` |
