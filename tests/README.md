# Testing Guide

## Overview

This project uses Vitest for testing with separate configurations for unit and integration tests.

## Local Test Environment Setup

### Prerequisites

1. **PostgreSQL** must be running locally on port 5432
   ```bash
   # Start PostgreSQL with Docker Compose
   docker-compose up -d db
   ```

2. **Redis** must be running locally on port 6379
   ```bash
   # Start Redis with Docker Compose
   docker-compose up -d redis
   ```

### Test Database

Tests use a separate database (`booking_portal_test`) to avoid affecting your development data.

The test database is automatically created when you run:
```bash
pnpm test:setup
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests (creates test DB first)
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Test Structure

```
tests/
├── unit/              # Unit tests (isolated, no external dependencies)
│   └── server/
│       └── db/
├── integration/       # Integration tests (use real database)
│   ├── api/          # API endpoint tests
│   └── db/           # Database tests
├── setup.ts          # Global test setup
├── teardown.ts       # Global test teardown
└── README.md         # This file
```

## Environment Variables

Test environment variables are loaded from `.env.test`:

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_portal_test
REDIS_URL=redis://localhost:6379/1
```

## Writing Tests

### Unit Tests
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should work correctly', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### Integration Tests
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, setupTestDb, cleanupTestDb } from './test-utils';

describe('Database Feature', () => {
  const db = createTestDb();

  beforeAll(async () => {
    await setupTestDb(db);
  });

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  it('should perform database operation', async () => {
    // Your test here
  });
});
```

## Troubleshooting

### Database Connection Errors

If you see "database does not exist" errors:
```bash
pnpm test:setup
```

### Port Already in Use

Make sure PostgreSQL is running on port 5432:
```bash
docker-compose ps
```

### Test Timeouts

Integration tests have a 30-second timeout. If tests are timing out:
1. Check database connection
2. Check for infinite loops
3. Increase timeout in `vitest.config.ts`

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Descriptive Names**: Use clear test descriptions
4. **Single Responsibility**: Test one thing per test
5. **Use Test Utilities**: Leverage the helper functions in `test-utils.ts`