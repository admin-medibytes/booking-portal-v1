import { pgTable, text, timestamp, integer, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { bookings } from "./bookings";
import { encryptedText, encryptedTextNullable } from "./encrypted-column";

export const documentTypeEnum = pgEnum("document_type", [
  "medical_report",
  "test_result",
  "prescription",
  "insurance_card",
  "referral_letter",
  "other",
]);

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    documentType: documentTypeEnum("document_type").notNull(),

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

    // Soft delete
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    bookingIdIdx: index("documents_booking_id_idx").on(table.bookingId),
    uploadedByIdx: index("documents_uploaded_by_idx").on(table.uploadedBy),
    documentTypeIdx: index("documents_document_type_idx").on(table.documentType),
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
