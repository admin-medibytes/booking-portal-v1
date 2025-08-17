import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema/documents";
import { type Document, type CreateDocumentInput } from "@/types/document";

export class DocumentRepository {
  async create(data: CreateDocumentInput & { id: string; s3Key: string }): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values({
        id: data.id,
        bookingId: data.bookingId,
        uploadedBy: data.uploadedById,
        documentType: this.mapCategoryToDocumentType(data.category),
        s3Key: data.s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME!,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      })
      .returning();

    return this.mapToDocument(document);
  }

  async findById(id: string): Promise<Document | null> {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), isNull(documents.deletedAt)),
    });

    return document ? this.mapToDocument(document) : null;
  }

  async findByBookingId(bookingId: string): Promise<Document[]> {
    const results = await db.query.documents.findMany({
      where: and(eq(documents.bookingId, bookingId), isNull(documents.deletedAt)),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    return results.map(doc => this.mapToDocument(doc));
  }

  async update(
    id: string,
    data: { fileName?: string; category?: Document["category"] }
  ): Promise<Document> {
    const updateData: Record<string, unknown> = {};
    
    if (data.fileName !== undefined) {
      updateData.fileName = data.fileName;
    }
    
    if (data.category !== undefined) {
      updateData.documentType = this.mapCategoryToDocumentType(data.category);
    }

    const [document] = await db
      .update(documents)
      .set(updateData)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning();

    return this.mapToDocument(document);
  }

  async softDelete(id: string): Promise<void> {
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, id));
  }

  async hardDelete(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  private mapCategoryToDocumentType(
    category: Document["category"]
  ): "medical_report" | "test_result" | "prescription" | "insurance_card" | "referral_letter" | "other" {
    const mapping: Record<Document["category"], typeof documents.documentType.enumValues[number]> = {
      consent_form: "other",
      brief: "referral_letter",
      report: "medical_report",
      dictation: "other",
      other: "other",
    };

    return mapping[category];
  }

  private mapDocumentTypeToCategory(
    documentType: typeof documents.documentType.enumValues[number]
  ): Document["category"] {
    const mapping: Record<typeof documentType, Document["category"]> = {
      medical_report: "report",
      test_result: "report",
      prescription: "other",
      insurance_card: "other",
      referral_letter: "brief",
      other: "other",
    };

    return mapping[documentType];
  }

  private mapToDocument(dbDocument: {
    id: string;
    bookingId: string;
    uploadedBy: string;
    documentType: typeof documents.documentType.enumValues[number];
    s3Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    deletedAt: Date | null;
  }): Document {
    return {
      id: dbDocument.id,
      bookingId: dbDocument.bookingId,
      uploadedById: dbDocument.uploadedBy,
      s3Key: dbDocument.s3Key,
      fileName: dbDocument.fileName,
      fileSize: dbDocument.fileSize,
      mimeType: dbDocument.mimeType,
      category: this.mapDocumentTypeToCategory(dbDocument.documentType),
      createdAt: dbDocument.createdAt,
      updatedAt: dbDocument.createdAt, // Schema doesn't have updatedAt, use createdAt
      deletedAt: dbDocument.deletedAt,
    };
  }
}

export const documentRepository = new DocumentRepository();