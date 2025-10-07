import { v4 as uuidv4 } from "uuid";
import { pgTable, text, timestamp, integer, pgEnum, index, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, organizations, teams } from "./auth";
import { specialists } from "./specialists";
import { encryptedText, encryptedTextNullable } from "./encrypted-column";

export const bookingTypeEnum = pgEnum("booking_type", ["in-person", "telehealth"]);
export const bookingStatusEnum = pgEnum("booking_status", ["active", "closed", "archived"]);
export const bookingProgressStatusEnum = pgEnum("booking_progress_status", [
  "scheduled",
  "rescheduled",
  "cancelled",
  "no-show",
  "generating-report",
  "report-generated",
  "payment-received",
]);

export const referrers = pgTable("referrers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  userId: text("user_id").references(() => users.id), // empty if external referrer
  firstName: encryptedText("first_name").notNull(),
  lastName: encryptedText("last_name").notNull(),
  email: encryptedText("email"),
  phone: encryptedText("phone"),
  jobTitle: encryptedTextNullable("job_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const examinees = pgTable("examinees", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  referrerId: text("referrer_id")
    .notNull()
    .references(() => referrers.id),
  firstName: encryptedText("first_name").notNull(),
  lastName: encryptedText("last_name").notNull(),
  dateOfBirth: encryptedText("date_of_birth").notNull(),
  address: encryptedText("address").notNull(),
  email: encryptedText("email").notNull(),
  phoneNumber: encryptedText("phone_number"),
  authorizedContact: boolean("authorized_contact").notNull(),
  condition: encryptedText("condition").notNull(),
  caseType: encryptedText("case_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => referrers.id),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id),
    examineeId: text("examinee_id")
      .notNull()
      .references(() => examinees.id),
    status: bookingStatusEnum("status").notNull().default("active"),

    // Booking Details
    type: bookingTypeEnum("type").notNull(),
    duration: integer("duration").notNull(),
    location: text("location").notNull(),
    dateTime: timestamp("date_time"),

    // Acuity Integration
    acuityAppointmentId: integer("acuity_appointment_id").notNull().unique(),
    acuityAppointmentTypeId: integer("acuity_appointment_type_id").notNull(),
    acuityCalendarId: integer("acuity_calendar_id").notNull(),

    // Timestamps for booking
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    organizationIdIdx: index("bookings_organization_id_idx").on(table.organizationId),
    referrerIdIdx: index("bookings_referrer_id_idx").on(table.referrerId),
    specialistIdIdx: index("bookings_specialist_id_idx").on(table.specialistId),
    statusIdx: index("bookings_status_idx").on(table.status),
    acuityAppointmentIdIdx: index("bookings_acuity_appointment_id_idx").on(
      table.acuityAppointmentId
    ),
  })
);

export const bookingProgress = pgTable(
  "booking_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingProgressStatusEnum("from_status"),
    toStatus: bookingProgressStatusEnum("to_status").notNull(),
    changedById: text("changed_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdIdx: index("booking_progress_booking_id_idx").on(table.bookingId),
    changedByIdx: index("booking_progress_changed_by_idx").on(table.changedById),
  })
);

export const referrersRelations = relations(referrers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [referrers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [referrers.userId],
    references: [users.id],
  }),
  examinee: many(examinees),
  booking: many(bookings),
}));

export const examineesRelations = relations(examinees, ({ one }) => ({
  referrer: one(referrers, {
    fields: [examinees.referrerId],
    references: [referrers.id],
  }),
  bookings: one(bookings, {
    fields: [examinees.id],
    references: [bookings.examineeId],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, {
    fields: [bookings.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [bookings.createdById],
    references: [users.id],
  }),
  referrer: one(referrers, {
    fields: [bookings.referrerId],
    references: [referrers.id],
  }),
  examinee: one(examinees, {
    fields: [bookings.examineeId],
    references: [examinees.id],
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
  changedBy: one(users, {
    fields: [bookingProgress.changedById],
    references: [users.id],
  }),
}));
