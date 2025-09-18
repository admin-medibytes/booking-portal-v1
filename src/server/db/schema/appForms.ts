import { v4 as uuidv4 } from "uuid";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { acuityForms, acuityFormsFields } from "./acuity";

// Main app forms table - stores custom form configurations
export const appForms = pgTable(
  "app_forms",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    acuityFormId: integer("acuity_form_id")
      .notNull()
      .references(() => acuityForms.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    acuityFormIdIdx: index("idx_app_forms_acuity_form_id").on(table.acuityFormId),
    isActiveIdx: index("idx_app_forms_is_active").on(table.isActive),
    acuityFormIdUnique: unique("app_forms_acuity_form_id_unique").on(table.acuityFormId),
  })
);

// App form fields table - stores field-level customizations
export const appFormFields = pgTable(
  "app_form_fields",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    appFormId: text("app_form_id")
      .notNull()
      .references(() => appForms.id, { onDelete: "cascade" }),
    acuityFieldId: integer("acuity_field_id")
      .notNull()
      .references(() => acuityFormsFields.id, { onDelete: "cascade" }),

    // Custom Properties
    customLabel: varchar("custom_label", { length: 255 }),
    placeholderText: varchar("placeholder_text", { length: 255 }),
    helpText: text("help_text"),
    tooltipText: text("tooltip_text"),

    // Custom Field Type (only valid for Acuity textbox fields)
    customFieldType: varchar("custom_field_type", { length: 50 }).$type<
      "text" | "email" | "phone" | "number" | "date" | "dob" | "time" | "url" | null
    >(),

    // Validation
    isRequired: boolean("is_required").default(false).notNull(),
    validationRules: jsonb("validation_rules").$type<ValidationRules>().default({}).notNull(),

    // Hidden Field Config
    isHidden: boolean("is_hidden").default(false).notNull(),
    staticValue: text("static_value"),

    // Examinee Field Mapping
    examineeFieldMapping: varchar("examinee_field_mapping", { length: 50 })
      .$type<ExamineeFieldType | null>()
      .default(null),

    // Layout
    displayOrder: integer("display_order").notNull(),
    displayWidth: varchar("display_width", { length: 10 })
      .$type<"full" | "half" | "third">()
      .notNull()
      .default("full"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    appFormIdIdx: index("idx_app_form_fields_app_form_id").on(table.appFormId),
    displayOrderIdx: index("idx_app_form_fields_display_order").on(
      table.appFormId,
      table.displayOrder
    ),
    acuityFieldIdIdx: index("idx_app_form_fields_acuity_field_id").on(table.acuityFieldId),
    uniqueAppFormField: unique("app_form_fields_unique").on(table.appFormId, table.acuityFieldId),
  })
);

// Relations
export const appFormsRelations = relations(appForms, ({ one, many }) => ({
  acuityForm: one(acuityForms, {
    fields: [appForms.acuityFormId],
    references: [acuityForms.id],
  }),
  fields: many(appFormFields),
}));

export const appFormFieldsRelations = relations(appFormFields, ({ one }) => ({
  appForm: one(appForms, {
    fields: [appFormFields.appFormId],
    references: [appForms.id],
  }),
  acuityField: one(acuityFormsFields, {
    fields: [appFormFields.acuityFieldId],
    references: [acuityFormsFields.id],
  }),
}));

// Examinee Field Types - fields that can be mapped from form to examinee record
// These match the actual columns in the examinees table
export type ExamineeFieldType = 
  | "firstName"
  | "lastName" 
  | "dateOfBirth"
  | "email"
  | "phoneNumber"
  | "address"
  | "authorizedContact"
  | "condition"
  | "caseType";

// Validation Rules Type
export interface ValidationRules {
  type?: "email" | "phone" | "date" | "number" | "string";
  pattern?: string; // Regex pattern
  minLength?: number; // For strings
  maxLength?: number; // For strings
  min?: string | number; // For dates or numbers
  max?: string | number; // For dates or numbers
  message?: string; // Custom error message
}

// Type exports
export type AppForm = typeof appForms.$inferSelect;
export type NewAppForm = typeof appForms.$inferInsert;
export type AppFormField = typeof appFormFields.$inferSelect;
export type NewAppFormField = typeof appFormFields.$inferInsert;

// Helper type for form with fields
export type AppFormWithFields = AppForm & {
  fields: AppFormField[];
};
