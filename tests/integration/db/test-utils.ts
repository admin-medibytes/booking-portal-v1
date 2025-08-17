import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/server/db/schema/index";
import path from "path";

// Test database connection
let testClient: ReturnType<typeof postgres> | null = null;

export const createTestDb = () => {
  // Use singleton pattern to avoid multiple connections
  if (!testClient) {
    testClient = postgres(
      process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/booking_portal_test",
      {
        max: 5, // Allow a few connections for parallel tests
        idle_timeout: 20,
        connect_timeout: 10,
      }
    );
  }

  return drizzle(testClient, { schema });
};

// Close test database connection
export const closeTestDb = async () => {
  if (testClient) {
    await testClient.end();
    testClient = null;
  }
};

// Run migrations on test database
export const setupTestDb = async (db: ReturnType<typeof createTestDb>) => {
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "src/server/db/migrations"),
  });
};

// Clean up test data
export const cleanupTestDb = async (db: ReturnType<typeof createTestDb>) => {
  // Delete in reverse order of foreign key dependencies
  await db.delete(schema.documents).execute();
  await db.delete(schema.bookingProgress).execute();
  await db.delete(schema.bookings).execute();
  await db.delete(schema.webhookEvents).execute();
  await db.delete(schema.auditLogs).execute();
  await db.delete(schema.specialists).execute();
  await db.delete(schema.members).execute();
  await db.delete(schema.organizations).execute();
  await db.delete(schema.verifications).execute();
  await db.delete(schema.sessions).execute();
  await db.delete(schema.accounts).execute();
  await db.delete(schema.users).execute();
};

// Test data generators
export const generateTestUser = (overrides?: Partial<typeof schema.users.$inferInsert>) => ({
  id: crypto.randomUUID(),
  email: `test-${Date.now()}@example.com`,
  name: "Test User",
  firstName: "Test",
  lastName: "User",
  jobTitle: "Test Role",
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestOrganization = (
  overrides?: Partial<typeof schema.organizations.$inferInsert>
) => ({
  id: crypto.randomUUID(),
  name: "Test Organization",
  slug: `test-org-${Date.now()}`,
  logo: null,
  metadata: JSON.stringify({}),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestSpecialist = (
  userId: string,
  overrides?: Partial<typeof schema.specialists.$inferInsert>
) => ({
  id: crypto.randomUUID(),
  userId,
  name: "Dr. Test Specialist",
  acuityCalendarId: String(Math.floor(Math.random() * 100000)),
  specialty: "cardiology",
  location: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateTestBooking = (
  organizationId: string,
  referrerId: string,
  specialistId: string | null,
  overrides?: Partial<typeof schema.bookings.$inferInsert>
) => ({
  id: crypto.randomUUID(),
  organizationId,
  referrerId,
  specialistId,
  status: "active" as const,
  patientFirstName: "John",
  patientLastName: "Doe",
  patientDateOfBirth: new Date("1990-01-01"),
  patientPhone: "+1234567890",
  patientEmail: "patient@example.com",
  examinationType: "General Checkup",
  examLocation: "Main Hospital",
  notes: "Test notes",
  internalNotes: "Internal test notes",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
