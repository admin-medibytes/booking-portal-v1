import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import testApp from '../test-app';
import { testDb } from '../test-db';
import { users, organizations, members } from '@/server/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';

describe('Admin API Routes', () => {
  let adminUser: any;
  let adminSession: any;
  let testOrg: any;

  beforeEach(async () => {
    // Create test organization
    const [org] = await testDb.insert(organizations).values({
      id: 'test-org-123',
      name: 'Test Organization',
      slug: 'test-org',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    testOrg = org;

    // Create admin user
    const result = await auth.api.createUser({
      headers: new Headers(),
      body: {
        email: 'admin@test.com',
        password: 'adminpass123',
        name: 'Admin User',
        role: 'admin',
      },
    });
    adminUser = result?.user;

    // Create admin session
    const sessionResult = await auth.api.signInEmail({
      headers: new Headers(),
      body: {
        email: 'admin@test.com',
        password: 'adminpass123',
      },
    });
    adminSession = sessionResult;
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.delete(members).where(eq(members.organizationId, testOrg.id));
    await testDb.delete(users).where(eq(users.email, 'admin@test.com'));
    await testDb.delete(users).where(eq(users.email, 'test@example.com'));
    await testDb.delete(organizations).where(eq(organizations.id, testOrg.id));
  });

  describe('POST /api/admin/users', () => {
    it('creates a new user when authenticated as admin', async () => {
      const response = await testApp.request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${adminSession?.token}`,
        },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          jobTitle: 'Developer',
          role: 'user',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
    });

    it('returns 401 when not authenticated', async () => {
      const response = await testApp.request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          jobTitle: 'Developer',
          role: 'user',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('returns 403 when authenticated as non-admin', async () => {
      // Create regular user
      const userResult = await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: 'regular@test.com',
          password: 'userpass123',
          name: 'Regular User',
          role: 'user',
        },
      });

      const userSessionResult = await auth.api.signInEmail({
        headers: new Headers(),
        body: {
          email: 'regular@test.com',
          password: 'userpass123',
        },
      });

      const response = await testApp.request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${userSessionResult?.token}`,
        },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          jobTitle: 'Developer',
          role: 'user',
        }),
      });

      expect(response.status).toBe(403);

      // Cleanup
      await testDb.delete(users).where(eq(users.email, 'regular@test.com'));
    });

    it('validates required fields', async () => {
      const response = await testApp.request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${adminSession?.token}`,
        },
        body: JSON.stringify({
          email: 'invalid-email',
          name: '',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/users', () => {
    it('returns paginated user list', async () => {
      // Create some test users
      await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: 'user1@test.com',
          password: 'pass123',
          name: 'User 1',
          role: 'user',
        },
      });

      await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: 'user2@test.com',
          password: 'pass123',
          name: 'User 2',
          role: 'user',
        },
      });

      const response = await testApp.request('/api/admin/users?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Cookie': `session=${adminSession?.token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.users).toBeInstanceOf(Array);
      expect(data.page).toBe(1);
      expect(data.total).toBeGreaterThanOrEqual(2);

      // Cleanup
      await testDb.delete(users).where(eq(users.email, 'user1@test.com'));
      await testDb.delete(users).where(eq(users.email, 'user2@test.com'));
    });

    it('filters users by search term', async () => {
      await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: 'searchme@test.com',
          password: 'pass123',
          name: 'Search Me',
          role: 'user',
        },
      });

      const response = await testApp.request('/api/admin/users?search=searchme', {
        method: 'GET',
        headers: {
          'Cookie': `session=${adminSession?.token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.users.some((u: any) => u.email === 'searchme@test.com')).toBe(true);

      // Cleanup
      await testDb.delete(users).where(eq(users.email, 'searchme@test.com'));
    });
  });

  describe('POST /api/admin/invite-user', () => {
    it('creates and sends invitation for referrer', async () => {
      const response = await testApp.request('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${adminSession?.token}`,
        },
        body: JSON.stringify({
          email: 'referrer@example.com',
          role: 'referrer',
          organizationId: testOrg.id,
          firstName: 'Test',
          lastName: 'Referrer',
          jobTitle: 'Insurance Agent',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.invitation.email).toBe('referrer@example.com');
      expect(data.invitation.role).toBe('referrer');
    });

    it('creates and sends invitation for specialist', async () => {
      const response = await testApp.request('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${adminSession?.token}`,
        },
        body: JSON.stringify({
          email: 'specialist@example.com',
          role: 'specialist',
          organizationId: testOrg.id,
          firstName: 'Dr',
          lastName: 'Specialist',
          jobTitle: 'Orthopedic Surgeon',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.invitation.email).toBe('specialist@example.com');
      expect(data.invitation.role).toBe('specialist');
    });
  });

  describe('GET /api/admin/invitations', () => {
    it('returns invitation list', async () => {
      // Create an invitation first
      await testApp.request('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${adminSession?.token}`,
        },
        body: JSON.stringify({
          email: 'invited@example.com',
          role: 'referrer',
          organizationId: testOrg.id,
        }),
      });

      const response = await testApp.request('/api/admin/invitations', {
        method: 'GET',
        headers: {
          'Cookie': `session=${adminSession?.token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations).toBeInstanceOf(Array);
      expect(data.invitations.some((i: any) => i.email === 'invited@example.com')).toBe(true);
    });

    it('filters invitations by status', async () => {
      const response = await testApp.request('/api/admin/invitations?status=pending', {
        method: 'GET',
        headers: {
          'Cookie': `session=${adminSession?.token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations.every((i: any) => i.status === 'pending')).toBe(true);
    });
  });
});