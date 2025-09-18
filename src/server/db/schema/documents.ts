import { v4 as uuidv4 } from "uuid";
import { pgTable, text, timestamp, integer, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { bookings } from "./bookings";
import { encryptedText, encryptedTextNullable } from "./encrypted-column";

export const documentSectionEnum = pgEnum("document_section", [
  "ime_documents",
  "supplementary_documents",
]);

export const documentCategoryEnum = pgEnum("document_category", [
  "consent_form",
  "document_brief", 
  "dictation",
  "draft_report",
  "final_report",
]);

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    section: documentSectionEnum("section").notNull(),
    category: documentCategoryEnum("category").notNull(),

    // S3 Storage (Encrypted)
    s3Key: encryptedText("s3_key").notNull(),
    s3Bucket: text("s3_bucket").notNull(),

    // File Metadata (Encrypted)
    fileName: encryptedText("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),

    // Additional fields
    description: encryptedTextNullable("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    bookingIdIdx: index("documents_booking_id_idx").on(table.bookingId),
    uploadedByIdx: index("documents_uploaded_by_idx").on(table.uploadedBy),
    sectionIdx: index("documents_section_idx").on(table.section),
    categoryIdx: index("documents_category_idx").on(table.category),
    deletedAtIdx: index("documents_deleted_at_idx").on(table.deletedAt),
  })
);

export const documentsRelations = relations(documents, ({ one }) => ({
  booking: one(bookings, {
    fields: [documents.bookingId],
    references: [bookings.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));
