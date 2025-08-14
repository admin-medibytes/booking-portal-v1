# Testing Strategy

## Testing Pyramid
```
        E2E Tests (10%)
       /              \
    Integration Tests (30%)
   /                      \
Frontend Unit Tests | Backend Unit Tests (60%)
```

## Test Organization

### Frontend Tests
```text
tests/
├── unit/
│   ├── components/
│   │   ├── booking-card.test.tsx
│   │   └── specialist-select.test.tsx
│   └── hooks/
│       └── use-bookings.test.ts
└── e2e/
    └── booking-flow.spec.ts
```

### Backend Tests
```text
tests/
├── unit/
│   ├── services/
│   │   ├── booking.service.test.ts
│   │   └── acuity.service.test.ts
│   └── repositories/
│       └── booking.repository.test.ts
└── integration/
    └── api/
        ├── bookings.test.ts
        └── documents.test.ts
```

## Test Examples

### Frontend Component Test
```typescript
// tests/unit/components/booking-card.test.tsx
import { render, screen } from '@testing-library/react';
import { BookingCard } from '@/components/bookings/booking-card';
import { mockBooking } from '@/tests/fixtures';

describe('BookingCard', () => {
  it('displays booking information correctly', () => {
    render(<BookingCard booking={mockBooking} />);
    
    expect(screen.getByText(mockBooking.examineeName)).toBeInTheDocument();
    expect(screen.getByText(mockBooking.specialist.name)).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
  });
  
  it('shows telehealth badge for online appointments', () => {
    const telehealthBooking = {
      ...mockBooking,
      appointmentType: 'telehealth' as const,
    };
    
    render(<BookingCard booking={telehealthBooking} />);
    
    expect(screen.getByText('Telehealth')).toBeInTheDocument();
  });
});
```

### Backend API Test
```typescript
// tests/integration/api/bookings.test.ts
import { app } from '@/server/app';
import { db } from '@/server/lib/db';
import { createTestUser, createTestBooking } from '@/tests/helpers';

describe('POST /api/bookings', () => {
  let authToken: string;
  let user: any;
  
  beforeEach(async () => {
    await db.delete(bookings);
    user = await createTestUser({ role: 'user' });
    authToken = await getAuthToken(user);
  });
  
  it('creates a new booking successfully', async () => {
    const bookingData = {
      specialistId: 'specialist-123',
      appointmentDateTime: '2024-02-01T10:00:00Z',
      examineeName: 'John Doe',
      examineePhone: '0400123456',
    };
    
    const response = await app.request('/api/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });
    
    expect(response.status).toBe(201);
    const booking = await response.json();
    expect(booking.examineeName).toBe('John Doe');
    expect(booking.source).toBe('portal');
  });
});
```

### E2E Test
```typescript
// tests/e2e/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Creation Flow', () => {
  test('user can create a booking successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'referrer@lawfirm.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to create booking
    await page.waitForURL('/bookings');
    await page.click('text=Create Booking');
    
    // Select specialist
    await page.click('[data-specialist-id="specialist-123"]');
    await page.click('text=Continue');
    
    // Select time slot
    await page.click('[data-slot="2024-02-01T10:00:00"]');
    await page.click('text=Continue');
    
    // Enter examinee details
    await page.fill('[name="examineeName"]', 'John Doe');
    await page.fill('[name="examineePhone"]', '0400123456');
    await page.fill('[name="examineeEmail"]', 'john@example.com');
    
    // Submit
    await page.click('text=Create Booking');
    
    // Verify success
    await expect(page).toHaveURL(/\/bookings\/[a-z0-9-]+/);
    await expect(page.locator('h1')).toContainText('John Doe');
    await expect(page.locator('text=scheduled')).toBeVisible();
  });
});
```
