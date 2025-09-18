import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { specialistAppointmentTypes } from "./specialists";

// Stores synced appointment types from Acuity
export const acuityAppointmentTypes = pgTable(
  "acuity_appointment_types",
  {
    id: integer("id").primaryKey(),
    active: boolean("active").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    duration: integer("duration").notNull(), // Duration in minutes
    price: decimal("price", { precision: 10, scale: 2 }), // Price as decimal
    category: text("category").notNull().default(""),
    color: text("color"), // Hex color code
    private: boolean("private").notNull(),
    addonIds: jsonb("addon_ids").$type<number[]>().default([]).notNull(),
    schedulingUrl: text("scheduling_url").notNull(),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("acuity_appointment_types_name_idx").on(table.name),
    categoryIdx: index("acuity_appointment_types_category_idx").on(table.category),
    activeIdx: index("acuity_appointment_types_active_idx").on(table.active),
    lastSyncedAtIdx: index("acuity_appointment_types_last_synced_at_idx").on(table.lastSyncedAt),
  })
);

// Stores synced forms from Acuity
export const acuityForms = pgTable(
  "acuity_forms",
  {
    id: integer("id").primaryKey(), // ID from Acuity
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    hidden: boolean("hidden").notNull().default(false),
    appointmentTypeIds: jsonb("appointment_type_ids").$type<number[]>().default([]).notNull(),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for common queries
    nameIdx: index("acuity_forms_name_idx").on(table.name),
    hiddenIdx: index("acuity_forms_hidden_idx").on(table.hidden),
    lastSyncedAtIdx: index("acuity_forms_last_synced_at_idx").on(table.lastSyncedAt),
  })
);

// Stores synced form fields from Acuity
export const acuityFormsFields = pgTable(
  "acuity_forms_fields",
  {
    id: integer("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => acuityForms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull(),
    type: text("type")
      .$type<"textbox" | "textarea" | "dropdown" | "checkbox" | "checkboxlist" | "yesno" | "file">()
      .notNull(),
    options: jsonb("options").$type<string[]>(),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  },
  (table) => ({
    formIdIdx: index("acuity_forms_fields_form_id_idx").on(table.formId),
    lastSyncedAtIdx: index("acuity_forms_fields_last_synced_at_idx").on(table.lastSyncedAt),
  })
);

// Join table for many-to-many relationship between appointment types and forms
export const acuityAppointmentTypeForms = pgTable(
  "acuity_appointment_type_forms",
  {
    appointmentTypeId: integer("appointment_type_id")
      .notNull()
      .references(() => acuityAppointmentTypes.id, { onDelete: "cascade" }),
    formId: integer("form_id")
      .notNull()
      .references(() => acuityForms.id, { onDelete: "cascade" }),
  },
  (table) => ({
    // Composite primary key
    pk: index("acuity_appointment_type_forms_pk").on(table.appointmentTypeId, table.formId),
    // Individual indexes for lookups
    appointmentTypeIdIdx: index("acuity_appointment_type_forms_appointment_type_id_idx").on(
      table.appointmentTypeId
    ),
    formIdIdx: index("acuity_appointment_type_forms_form_id_idx").on(table.formId),
  })
);

// Relations for appointment types
export const acuityAppointmentTypesRelations = relations(acuityAppointmentTypes, ({ many }) => ({
  appointmentTypeForms: many(acuityAppointmentTypeForms),
  specialists: many(specialistAppointmentTypes),
}));

// Relations for forms
export const acuityFormsRelations = relations(acuityForms, ({ many }) => ({
  fields: many(acuityFormsFields),
  appointmentTypeForms: many(acuityAppointmentTypeForms),
}));

// Relations for form fields
export const acuityFormsFieldsRelations = relations(acuityFormsFields, ({ one }) => ({
  form: one(acuityForms, {
    fields: [acuityFormsFields.formId],
    references: [acuityForms.id],
  }),
}));

// Relations for the join table
export const acuityAppointmentTypeFormsRelations = relations(
  acuityAppointmentTypeForms,
  ({ one }) => ({
    appointmentType: one(acuityAppointmentTypes, {
      fields: [acuityAppointmentTypeForms.appointmentTypeId],
      references: [acuityAppointmentTypes.id],
    }),
    form: one(acuityForms, {
      fields: [acuityAppointmentTypeForms.formId],
      references: [acuityForms.id],
    }),
  })
);

// Type exports
export type AcuityAppointmentType = typeof acuityAppointmentTypes.$inferSelect;
export type AcuityForm = typeof acuityForms.$inferSelect;
export type AcuityFormField = typeof acuityFormsFields.$inferSelect;
export type AcuityAppointmentTypeForm = typeof acuityAppointmentTypeForms.$inferSelect;
