import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, setupTestDb, cleanupTestDb, generateTestUser, generateTestOrganization, generateTestSpecialist, generateTestBooking } from './test-utils';
import * as schema from '@/server/db/schema/index';
import { eq, and, desc } from 'drizzle-orm';

describe('Booking Progress Tracking', () => {
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

  describe('Progress History', () => {
    it('should track booking status changes', async () => {
      // Setup test data
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.users).values(user);
      await db.insert(schema.organizations).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id);
      await db.insert(schema.bookings).values(booking);

      // Record initial status
      await db.insert(schema.bookingProgress).values({
        bookingId: booking.id,
        fromStatus: null,
        toStatus: 'scheduled',
        changedBy: user.id,
        reason: 'Booking created',
        metadata: { source: 'web_portal' },
      });

      // Change to scheduled
      await db.transaction(async (tx) => {
        await tx.update(schema.bookings)
          .set({ 
            status: 'active',
            scheduledAt: new Date(),
            examDate: new Date(Date.now() + 86400000),
          })
          .where(eq(schema.bookings.id, booking.id));

        await tx.insert(schema.bookingProgress).values({
          bookingId: booking.id,
          fromStatus: 'scheduled',
          toStatus: 'scheduled',
          changedBy: user.id,
          reason: 'Appointment scheduled',
          metadata: { 
            examDate: new Date(Date.now() + 86400000).toISOString(),
            specialistName: 'Dr. Smith',
          },
        });
      });

      // Retrieve progress history
      const progress = await db.query.bookingProgress.findMany({
        where: eq(schema.bookingProgress.bookingId, booking.id),
        orderBy: [desc(schema.bookingProgress.createdAt)],
      });

      expect(progress).toHaveLength(2);
      expect(progress[1]).toMatchObject({
        fromStatus: null,
        toStatus: 'scheduled',
        reason: 'Booking created',
      });
      expect(progress[0]).toMatchObject({
        fromStatus: 'scheduled',
        toStatus: 'scheduled',
        reason: 'Appointment scheduled',
      });
    });

    it('should track cancellation with reason', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.users).values(user);
      await db.insert(schema.organizations).values(org);

      const booking = generateTestBooking(org.id, user.id, null, {
        status: 'active',
        scheduledAt: new Date(),
      });
      await db.insert(schema.bookings).values(booking);

      // Cancel booking
      await db.transaction(async (tx) => {
        await tx.update(schema.bookings)
          .set({ 
            status: 'closed',
            cancelledAt: new Date(),
          })
          .where(eq(schema.bookings.id, booking.id));

        await tx.insert(schema.bookingProgress).values({
          bookingId: booking.id,
          fromStatus: 'scheduled',
          toStatus: 'cancelled',
          changedBy: user.id,
          reason: 'Patient requested cancellation',
          metadata: { 
            cancellationReason: 'scheduling_conflict',
            notifiedSpecialist: true,
          },
        });
      });

      const booking_result = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
        with: {
          progress: {
            orderBy: [desc(schema.bookingProgress.createdAt)],
          },
        },
      });

      expect(booking_result?.status).toBe('closed');
      expect(booking_result?.cancelledAt).toBeInstanceOf(Date);
      expect(booking_result?.progress[0]).toMatchObject({
        toStatus: 'cancelled',
        reason: 'Patient requested cancellation',
      });
    });

    it('should handle no-show status', async () => {
      const user = generateTestUser();
      const adminUser = generateTestUser({ email: 'admin@example.com' });
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.users).values([user, adminUser]);
      await db.insert(schema.organizations).values(org);
      await db.insert(schema.specialists).values(specialist);

      const examDate = new Date(Date.now() - 86400000); // Yesterday
      const booking = generateTestBooking(org.id, user.id, specialist.id, {
        status: 'active',
        scheduledAt: new Date(Date.now() - 172800000), // 2 days ago
        examDate,
      });
      await db.insert(schema.bookings).values(booking);

      // Mark as no-show
      await db.transaction(async (tx) => {
        await tx.update(schema.bookings)
          .set({ status: 'closed' })
          .where(eq(schema.bookings.id, booking.id));

        await tx.insert(schema.bookingProgress).values({
          bookingId: booking.id,
          fromStatus: 'scheduled',
          toStatus: 'no-show',
          changedBy: adminUser.id,
          reason: 'Patient did not attend appointment',
          metadata: { 
            appointmentTime: examDate.toISOString(),
            attemptedContact: true,
            contactMethod: 'phone',
          },
        });
      });

      const progress = await db.query.bookingProgress.findFirst({
        where: and(
          eq(schema.bookingProgress.bookingId, booking.id),
          eq(schema.bookingProgress.toStatus, 'no-show')
        ),
      });

      expect(progress).toBeDefined();
      expect(progress?.changedBy).toBe(adminUser.id);
      expect(progress?.metadata).toHaveProperty('attemptedContact', true);
    });

    it('should track completion with details', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.users).values(user);
      await db.insert(schema.organizations).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id, {
        status: 'active',
        scheduledAt: new Date(Date.now() - 86400000),
        examDate: new Date(),
      });
      await db.insert(schema.bookings).values(booking);

      // Complete booking
      await db.transaction(async (tx) => {
        await tx.update(schema.bookings)
          .set({ 
            status: 'closed',
            completedAt: new Date(),
          })
          .where(eq(schema.bookings.id, booking.id));

        await tx.insert(schema.bookingProgress).values({
          bookingId: booking.id,
          fromStatus: 'scheduled',
          toStatus: 'report-generated',
          changedBy: specialist.userId,
          reason: 'Examination completed successfully',
          metadata: { 
            duration: '45 minutes',
            reportGenerated: true,
            followUpRequired: false,
          },
        });
      });

      const completedBooking = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
        with: {
          progress: {
            where: eq(schema.bookingProgress.toStatus, 'report-generated'),
          },
        },
      });

      expect(completedBooking?.status).toBe('closed');
      expect(completedBooking?.completedAt).toBeInstanceOf(Date);
      expect(completedBooking?.progress[0]?.metadata).toHaveProperty('reportGenerated', true);
    });
  });

  describe('Progress Metadata', () => {
    it('should store complex metadata in JSONB field', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.users).values(user);
      await db.insert(schema.organizations).values(org);

      const booking = generateTestBooking(org.id, user.id, null);
      await db.insert(schema.bookings).values(booking);

      const complexMetadata = {
        reschedulingDetails: {
          originalDate: new Date(Date.now() + 86400000).toISOString(),
          newDate: new Date(Date.now() + 172800000).toISOString(),
          reason: 'Specialist unavailable',
          attempts: 2,
        },
        notifications: {
          patientNotified: true,
          notificationMethod: 'email',
          notificationTime: new Date().toISOString(),
        },
        systemInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          source: 'web_portal',
        },
      };

      await db.insert(schema.bookingProgress).values({
        bookingId: booking.id,
        fromStatus: 'scheduled',
        toStatus: 'rescheduled',
        changedBy: user.id,
        reason: 'Appointment rescheduled',
        metadata: complexMetadata,
      });

      const progress = await db.query.bookingProgress.findFirst({
        where: eq(schema.bookingProgress.bookingId, booking.id),
      });

      expect(progress?.metadata).toEqual(complexMetadata);
      expect((progress?.metadata as any)?.reschedulingDetails?.attempts).toBe(2);
    });
  });
});