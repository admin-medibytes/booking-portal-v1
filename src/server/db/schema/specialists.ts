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

export const specialistsRelations = relations(specialists, ({ one }) => ({
  user: one(users, {
    fields: [specialists.userId],
    references: [users.id],
  }),
}));
