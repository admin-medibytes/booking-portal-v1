import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  integer,
  unique,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";

export interface SpecialistLocation {
  streetAddress?: string;
  suburb?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
}

export const specialists = pgTable(
  "specialists",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acuityCalendarId: text("acuity_calendar_id").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    image: text("image"),
    location: jsonb("location").$type<SpecialistLocation>(),
    acceptsInPerson: boolean("accepts_in_person").default(false).notNull(),
    acceptsTelehealth: boolean("accepts_telehealth").default(true).notNull(),
    position: integer("position").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("specialists_user_id_idx").on(table.userId),
    acuityCalendarIdIdx: index("specialists_acuity_calendar_id_idx").on(table.acuityCalendarId),
    slugIdx: index("specialists_slug_idx").on(table.slug),
    isActiveIdx: index("specialists_is_active_idx").on(table.isActive),
    positionIdx: index("specialists_position_idx").on(table.position),
    positionUnique: unique("unique_specialist_position").on(table.position),
    locationCityIdx: index("specialists_location_city_idx").on(sql`(location->>'city')`),
    locationStateIdx: index("specialists_location_state_idx").on(sql`(location->>'state')`),
    locationRequiredFields: check(
      "location_required_fields",
      sql`location IS NULL OR (location->>'city' IS NOT NULL AND location->>'state' IS NOT NULL AND location->>'country' IS NOT NULL)`
    ),
  })
);

export const specialistsRelations = relations(specialists, ({ one, many }) => ({
  user: one(users, {
    fields: [specialists.userId],
    references: [users.id],
  }),
  appointmentTypes: many(specialistAppointmentTypes),
}));

export const appointmentTypes = pgTable(
  "appointment_types",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    acuityAppointmentTypeId: integer("acuity_appointment_type_id").notNull().unique(),
    acuityName: text("acuity_name").notNull(),
    acuityDescription: text("acuity_description"),
    durationMinutes: integer("duration_minutes").notNull(),
    category: text("category"),
    active: boolean("active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    acuityAppointmentTypeIdIdx: index("appointment_types_acuity_id_idx").on(table.acuityAppointmentTypeId),
    activeIdx: index("appointment_types_active_idx").on(table.active),
    categoryIdx: index("appointment_types_category_idx").on(table.category),
  })
);

export const appointmentTypesRelations = relations(appointmentTypes, ({ many }) => ({
  specialists: many(specialistAppointmentTypes),
}));

export const specialistAppointmentTypes = pgTable(
  "specialist_appointment_types",
  {
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    appointmentTypeId: text("appointment_type_id")
      .notNull()
      .references(() => appointmentTypes.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true).notNull(),
    customDisplayName: text("custom_display_name"),
    customDescription: text("custom_description"),
    customPrice: integer("custom_price"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: unique("specialist_appointment_types_pk").on(table.specialistId, table.appointmentTypeId),
    specialistIdIdx: index("specialist_appointment_types_specialist_id_idx").on(table.specialistId),
    appointmentTypeIdIdx: index("specialist_appointment_types_appointment_type_id_idx").on(table.appointmentTypeId),
    enabledIdx: index("specialist_appointment_types_enabled_idx").on(table.enabled),
  })
);

export const specialistAppointmentTypesRelations = relations(specialistAppointmentTypes, ({ one }) => ({
  specialist: one(specialists, {
    fields: [specialistAppointmentTypes.specialistId],
    references: [specialists.id],
  }),
  appointmentType: one(appointmentTypes, {
    fields: [specialistAppointmentTypes.appointmentTypeId],
    references: [appointmentTypes.id],
  }),
}));
