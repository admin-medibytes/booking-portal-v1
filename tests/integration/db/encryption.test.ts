import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, setupTestDb, cleanupTestDb, generateTestUser, generateTestOrganization, generateTestSpecialist, generateTestBooking } from './test-utils';
import * as schema from '@/server/db/schema/index';
import { eq, sql } from 'drizzle-orm';

describe('Database Encryption', () => {
  const db = createTestDb();

  beforeAll(async () => {
    await setupTestDb(db);
  });

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    // Cleanup is handled by the singleton connection
    // No need to close here as other tests might be using it
  });

  describe('Booking Encryption', () => {
    it('should encrypt and decrypt patient information correctly', async () => {
      // Create test data
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id, {
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientPhone: '+1234567890',
        patientEmail: 'john.doe@example.com',
        notes: 'Sensitive medical notes',
        internalNotes: 'Internal sensitive notes',
      });

      // Insert booking
      await db.insert(schema.bookings).values(booking);

      // Retrieve booking
      const retrieved = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.patientFirstName).toBe('John');
      expect(retrieved?.patientLastName).toBe('Doe');
      expect(retrieved?.patientPhone).toBe('+1234567890');
      expect(retrieved?.patientEmail).toBe('john.doe@example.com');
      expect(retrieved?.notes).toBe('Sensitive medical notes');
      expect(retrieved?.internalNotes).toBe('Internal sensitive notes');

      // Verify data is encrypted in database by checking raw query
      const rawResult = await db.execute(
        sql<{ patient_first_name: string }[]>`SELECT patient_first_name FROM bookings WHERE id = ${booking.id}`
      );
      
      // The raw value should be base64 encrypted and not equal to plain text
      const rawValue = rawResult[0]?.patient_first_name;
      expect(rawValue).toBeDefined();
      expect(rawValue).not.toBe('John');
      expect(rawValue).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
    });

    it('should handle null values correctly for optional encrypted fields', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id, {
        patientEmail: null,
        notes: null,
        internalNotes: null,
      });

      await db.insert(schema.bookings).values(booking);

      const retrieved = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id),
      });

      expect(retrieved?.patientEmail).toBeNull();
      expect(retrieved?.notes).toBeNull();
      expect(retrieved?.internalNotes).toBeNull();
    });
  });

  describe('Document Encryption', () => {
    it('should encrypt and decrypt document fields correctly', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      const specialist = generateTestSpecialist(user.id);
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);
      await db.insert(schema.specialists).values(specialist);

      const booking = generateTestBooking(org.id, user.id, specialist.id);
      await db.insert(schema.bookings).values(booking);

      const document = {
        id: crypto.randomUUID(),
        bookingId: booking.id,
        uploadedBy: user.id,
        documentType: 'medical_report' as const,
        s3Key: 'sensitive/path/to/file.pdf',
        s3Bucket: 'medibytes-documents',
        fileName: 'patient-medical-report.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        description: 'Confidential medical report',
        createdAt: new Date(),
      };

      await db.insert(schema.documents).values(document);

      const retrieved = await db.query.documents.findFirst({
        where: eq(schema.documents.id, document.id),
      });

      expect(retrieved?.s3Key).toBe('sensitive/path/to/file.pdf');
      expect(retrieved?.fileName).toBe('patient-medical-report.pdf');
      expect(retrieved?.description).toBe('Confidential medical report');

      // Verify encryption in raw query
      const rawResult = await db.execute(
        sql<{ s3_key: string; file_name: string }[]>`SELECT s3_key, file_name FROM documents WHERE id = ${document.id}`
      );
      
      const raw = rawResult[0];
      expect(raw?.s3_key).not.toBe('sensitive/path/to/file.pdf');
      expect(raw?.file_name).not.toBe('patient-medical-report.pdf');
      expect(raw?.s3_key).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(raw?.file_name).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  describe('Encryption Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const user = generateTestUser();
      const org = generateTestOrganization();
      
      await db.insert(schema.user).values(user);
      await db.insert(schema.organization).values(org);

      const specialists = Array.from({ length: 10 }, () => 
        generateTestSpecialist(user.id)
      );
      
      await db.insert(schema.specialists).values(specialists);

      const bookings = specialists.map((specialist) =>
        generateTestBooking(org.id, user.id, specialist.id)
      );

      const startTime = Date.now();
      await db.insert(schema.bookings).values(bookings);
      const insertTime = Date.now() - startTime;

      const retrieveStart = Date.now();
      const retrieved = await db.query.bookings.findMany();
      const retrieveTime = Date.now() - retrieveStart;

      // Ensure operations complete in reasonable time (under 3 seconds for 10 records)
      expect(insertTime).toBeLessThan(3000);
      expect(retrieveTime).toBeLessThan(3000);
      expect(retrieved).toHaveLength(10);
    });
  });
});