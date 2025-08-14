import { pgTable, text, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user, organization } from './auth';
import { specialists } from './specialists';
import { encryptedText, encryptedTextNullable } from './encrypted-column';

export const bookingStatusEnum = pgEnum('booking_status', [
  'scheduling',
  'scheduled',
  'completed',
  'no_show',
  'cancelled'
]);

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  referrerId: text('referrer_id').notNull().references(() => user.id),
  specialistId: text('specialist_id').references(() => specialists.id),
  status: bookingStatusEnum('status').notNull().default('scheduling'),
  
  // Patient Information (Encrypted)
  patientFirstName: encryptedText('patient_first_name').notNull(),
  patientLastName: encryptedText('patient_last_name').notNull(),
  patientDateOfBirth: timestamp('patient_date_of_birth').notNull(),
  patientPhone: encryptedText('patient_phone').notNull(),
  patientEmail: encryptedTextNullable('patient_email'),
  
  // Booking Details
  examinationType: text('examination_type').notNull(),
  examLocation: text('exam_location').notNull(),
  examDate: timestamp('exam_date'),
  notes: encryptedTextNullable('notes'),
  internalNotes: encryptedTextNullable('internal_notes'),
  
  // Acuity Integration
  acuityAppointmentId: integer('acuity_appointment_id').unique(),
  acuityCalendarId: integer('acuity_calendar_id'),
  
  // Timestamps for status tracking
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('bookings_organization_id_idx').on(table.organizationId),
  referrerIdIdx: index('bookings_referrer_id_idx').on(table.referrerId),
  specialistIdIdx: index('bookings_specialist_id_idx').on(table.specialistId),
  statusIdx: index('bookings_status_idx').on(table.status),
  acuityAppointmentIdIdx: index('bookings_acuity_appointment_id_idx').on(table.acuityAppointmentId),
}));

export const bookingProgress = pgTable('booking_progress', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  fromStatus: bookingStatusEnum('from_status'),
  toStatus: bookingStatusEnum('to_status').notNull(),
  changedBy: text('changed_by').notNull().references(() => user.id),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  bookingIdIdx: index('booking_progress_booking_id_idx').on(table.bookingId),
  changedByIdx: index('booking_progress_changed_by_idx').on(table.changedBy),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organization, {
    fields: [bookings.organizationId],
    references: [organization.id],
  }),
  referrer: one(user, {
    fields: [bookings.referrerId],
    references: [user.id],
  }),
  specialist: one(specialists, {
    fields: [bookings.specialistId],
    references: [specialists.id],
  }),
  progress: many(bookingProgress),
}));

export const bookingProgressRelations = relations(bookingProgress, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingProgress.bookingId],
    references: [bookings.id],
  }),
  changedBy: one(user, {
    fields: [bookingProgress.changedBy],
    references: [user.id],
  }),
}));