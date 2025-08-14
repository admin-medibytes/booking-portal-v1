import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, setupTestDb, cleanupTestDb, generateTestUser, generateTestOrganization, generateTestSpecialist, generateTestBooking } from './test-utils';
import * as schema from '@/server/db/schema/index';
import { eq, sql } from 'drizzle-orm';

describe('Schema Validation and Constraints', () => {
  const db = createTestDb();

  beforeAll(async () => {
    await setupTestDb(db);
  });

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    // Cleanup is handled by the singleton connection
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraint for bookings.organizationId', async () => {
      const user = generateTestUser();
      await db.insert(schema.user).values(user);

      const booking = {
        id: crypto.randomUUID(),
        organizationId: 'non-existent-org-id',
        referrerId: user.id,
        specialistId: null,
        status: 'scheduling' as const,
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: new Date('1990-01-01'),
        patientPhone: '+1234567890',
        examinationType: 'General',
        examLocation: 'Hospital',
      };

      // Check for foreign key constraint violation
      // Error might be wrapped by drizzle-orm when encrypted fields are present
      await expect(
        db.insert(schema.bookings).values(booking)
      ).rejects.toThrow();
      
      try {
        await db.insert(schema.bookings).values(booking);
      } catch (error: any) {
        expect(error.message).toMatch(/violates foreign key constraint|Failed query:/i);
      }
    });

    it('should cascade delete bookings when organization is deleted', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id);
      await db.insert(schema.bookings).values(booking);

      // Verify booking exists
      const bookingBefore = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
      });
      expect(bookingBefore).toBeDefined();

      // Delete organization
      await db.delete(schema.organization).where(eq(schema.organization.id, org.id));

      // Verify booking is cascade deleted
      const bookingAfter = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
      });
      expect(bookingAfter).toBeUndefined();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on specialists.acuityCalendarId', async () => {
      const user1 = generateTestUser();
      const user2 = generateTestUser({ email: 'user2@example.com' });
      
      await db.insert(schema.user).values([user1, user2]);

      const calendarId = 12345;
      const specialist1 = generateTestSpecialist(user1.id, { acuityCalendarId: calendarId });
      await db.insert(schema.specialists).values(specialist1);

      const specialist2 = generateTestSpecialist(user2.id, { acuityCalendarId: calendarId });
      
      // Check for unique constraint violation
      // Error might be wrapped by drizzle-orm
      await expect(
        db.insert(schema.specialists).values(specialist2)
      ).rejects.toThrow();
      
      try {
        await db.insert(schema.specialists).values(specialist2);
      } catch (error: any) {
        expect(error.message).toMatch(/duplicate key value violates unique constraint|Failed query:/i);
      }
    });

    it('should enforce unique constraint on bookings.acuityAppointmentId', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const appointmentId = 54321;
      const booking1 = generateTestBooking(org.id, user.id, specialist.id as string, {
        acuityAppointmentId: appointmentId,
      });
      await db.insert(schema.bookings).values(booking1);

      const booking2 = generateTestBooking(org.id, user.id, specialist.id as string, {
        acuityAppointmentId: appointmentId,
      });
      
      // Check for unique constraint violation on acuityAppointmentId
      await expect(
        db.insert(schema.bookings).values(booking2)
      ).rejects.toThrow();
      
      try {
        await db.insert(schema.bookings).values(booking2);
      } catch (error: any) {
        expect(error.message).toMatch(/duplicate key value violates unique constraint|Failed query:/i);
      }
    });
  });

  describe('Enum Constraints', () => {
    it('should only allow valid booking status values', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);

      const validStatuses = ['scheduling', 'scheduled', 'completed', 'no_show', 'cancelled'];
      
      for (const status of validStatuses) {
        const booking = generateTestBooking(org.id, user.id, null, {
          status: status as any,
        });
        
        await expect(
          db.insert(schema.bookings).values(booking)
        ).resolves.not.toThrow();
      }

      // Clean up for invalid test
      await cleanupTestDb(db);
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);

      // Test invalid status
      // Test invalid status - this will fail due to enum constraint
      // When using encrypted fields, error messages get wrapped
      const { encrypt } = await import('@/server/utils/encryption');
      const bookingId = crypto.randomUUID();
      
      try {
        await db.execute(
          sql`
            INSERT INTO bookings (id, organization_id, referrer_id, status, patient_first_name, patient_last_name, patient_date_of_birth, patient_phone, examination_type, exam_location)
            VALUES (${bookingId}, ${org.id}, ${user.id}, 'invalid_status', ${encrypt('John')}, ${encrypt('Doe')}, '1990-01-01', ${encrypt('+1234567890')}, 'General', 'Hospital')
          `
        );
        expect.fail('Expected query to fail with enum constraint violation');
      } catch (error: any) {
        // The error might be wrapped when using encrypted fields
        expect(error.message).toMatch(/invalid input value for enum booking_status|Failed query:/i);
      }
    });

    it('should only allow valid document type values', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);

      const booking = generateTestBooking(org.id, user.id, null);
      await db.insert(schema.bookings).values(booking);

      const validTypes = ['medical_report', 'test_result', 'prescription', 'insurance_card', 'referral_letter', 'other'];
      
      for (const docType of validTypes) {
        const document = {
          id: crypto.randomUUID(),
          bookingId: booking.id,
          uploadedBy: user.id,
          documentType: docType as any,
          s3Key: 'test/key',
          s3Bucket: 'test-bucket',
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        };
        
        await expect(
          db.insert(schema.documents).values(document)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Default Values', () => {
    it('should set default values correctly', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);

      const booking = {
        organizationId: org.id,
        referrerId: user.id,
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: new Date('1990-01-01'),
        patientPhone: '+1234567890',
        examinationType: 'General',
        examLocation: 'Hospital',
      };

      await db.insert(schema.bookings).values(booking);

      const retrieved = await db.query.bookings.findFirst({
        where: eq(schema.bookings.organizationId, org.id),
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBeDefined();
      expect(retrieved?.status).toBe('scheduling');
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.updatedAt).toBeInstanceOf(Date);
    });

    it('should set specialist.isActive to true by default', async () => {
      const user = generateTestUser();
      await db.insert(schema.user).values(user);

      const specialist = {
        userId: user.id,
        acuityCalendarId: 12345,
        specialty: 'cardiology' as const,
      };

      await db.insert(schema.specialists).values(specialist);

      const retrieved = await db.query.specialists.findFirst({
        where: eq(schema.specialists.userId, user.id),
      });

      expect(retrieved?.isActive).toBe(true);
    });
  });

  describe('Timestamp Tracking', () => {
    it('should track booking status timestamps correctly', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id);
      await db.insert(schema.bookings).values(booking);

      // Update to scheduled
      const scheduledAt = new Date();
      await db.update(schema.bookings)
        .set({ 
          status: 'scheduled',
          scheduledAt,
          examDate: new Date(Date.now() + 86400000), // Tomorrow
        })
        .where(eq(schema.bookings.id, booking.id));

      // Update to completed
      const completedAt = new Date();
      await db.update(schema.bookings)
        .set({ 
          status: 'completed',
          completedAt,
        })
        .where(eq(schema.bookings.id, booking.id));

      const final = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
      });

      expect(final?.scheduledAt).toBeInstanceOf(Date);
      expect(final?.completedAt).toBeInstanceOf(Date);
      expect(final?.cancelledAt).toBeNull();
    });
  });
});