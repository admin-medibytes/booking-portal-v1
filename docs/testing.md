# Testing Guide

## Overview

This project uses a containerized test environment to ensure consistent testing across all environments. Integration tests run against dedicated PostgreSQL and Redis containers to avoid conflicts with local development databases.

## Test Environment Setup

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm installed

### Test Container Configuration

The test environment uses separate containers defined in `docker-compose.test.yml`:

- **PostgreSQL**: Runs on port 5433 (instead of default 5432)
- **Redis**: Runs on port 6380 (instead of default 6379)

This allows running tests without affecting your local development environment.

## Running Tests

### Quick Commands

```bash
# Run all tests (unit + integration)
pnpm test

# Run only unit tests
pnpm test:unit

# Run integration tests (automatically starts/stops test environment)
pnpm test:integration

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Test Environment Management

```bash
# Start test environment containers
pnpm test:env:start

# Stop test environment containers
pnpm test:env:stop

# Clean test environment (removes all data)
pnpm test:env:clean
```

### Manual Test Environment Setup

If you need to manually manage the test environment:

1. Start the test containers:
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

2. Wait for services to be ready:
   ```bash
   # Check PostgreSQL
   docker exec booking-portal-postgres-test pg_isready -U postgres
   
   # Check Redis
   docker exec booking-portal-redis-test redis-cli ping
   ```

3. Run database migrations:
   ```bash
   pnpm test:setup
   ```

## Test Structure

### Unit Tests
- Location: `tests/unit/`
- Environment: jsdom
- Focus: Component and utility function testing
- No database or external service dependencies

### Integration Tests
- Location: `tests/integration/`
- Environment: node
- Focus: Database operations, API endpoints, service integrations
- Uses test containers for PostgreSQL and Redis

## Environment Variables

Test-specific environment variables are defined in `.env.test`:

```env
# Database (test container)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/booking_portal_test

# Redis (test container)
REDIS_URL=redis://localhost:6380/1

# Other test-specific settings
NODE_ENV=test
LOG_LEVEL=error
SKIP_ENV_VALIDATION=true
```

## CI/CD Integration

GitHub Actions automatically:
1. Spins up PostgreSQL and Redis services
2. Runs type checking and linting
3. Executes unit tests
4. Sets up test database with migrations
5. Runs integration tests

See `.github/workflows/test.yml` for the complete CI configuration.

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data after each test
3. **Mocking**: Mock external services (AWS, Acuity) in integration tests
4. **Performance**: Use connection pooling and reuse database connections
5. **Security**: Never use production credentials in test environments

## Troubleshooting

### Port Conflicts

If you get port binding errors:
```bash
# Check if ports are in use
lsof -i :5433  # PostgreSQL test port
lsof -i :6380  # Redis test port

# Stop conflicting services or change ports in docker-compose.test.yml
```

### Database Connection Issues

If tests can't connect to the database:
```bash
# Verify containers are running
docker ps

# Check container logs
docker logs booking-portal-postgres-test
docker logs booking-portal-redis-test

# Restart test environment
pnpm test:env:clean
pnpm test:env:start
```

### Migration Failures

If database migrations fail:
```bash
# Connect to test database
docker exec -it booking-portal-postgres-test psql -U postgres -d booking_portal_test

# Check existing tables
\dt

# Drop and recreate if needed
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```