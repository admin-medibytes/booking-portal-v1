import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema/documents";
import { type Document, type CreateDocumentInput, type DocumentSection, type DocumentCategory } from "@/types/document";
import { getS3Bucket } from "@/server/utils/s3";

export class DocumentRepository {
  async create(data: CreateDocumentInput & { id: string; s3Key: string }): Promise<Document> {
    const bucket = getS3Bucket();

    const [document] = await db
      .insert(documents)
      .values({
        id: data.id,
        bookingId: data.bookingId,
        uploadedBy: data.uploadedById,
        section: data.section,
        category: data.category,
        s3Key: data.s3Key,
        s3Bucket: bucket,
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
      with: {
        uploadedBy: true,
      },
    });

    return document ? this.mapToDocument(document) : null;
  }

  async findByBookingId(
    bookingId: string,
    filters?: {
      section?: DocumentSection;
      category?: DocumentCategory;
    }
  ): Promise<Document[]> {
    const conditions = [eq(documents.bookingId, bookingId), isNull(documents.deletedAt)];
    
    if (filters?.section) {
      conditions.push(eq(documents.section, filters.section));
    }
    
    if (filters?.category) {
      conditions.push(eq(documents.category, filters.category));
    }
    
    const results = await db.query.documents.findMany({
      where: and(...conditions),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      with: {
        uploadedBy: true,
      },
    });

    return results.map(doc => this.mapToDocument(doc));
  }

  async update(
    id: string,
    data: { fileName?: string; section?: DocumentSection; category?: DocumentCategory }
  ): Promise<Document> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    if (data.fileName !== undefined) {
      updateData.fileName = data.fileName;
    }
    
    if (data.section !== undefined) {
      updateData.section = data.section;
    }
    
    if (data.category !== undefined) {
      updateData.category = data.category;
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


  private mapToDocument(dbDocument: any): Document {
    return {
      id: dbDocument.id,
      bookingId: dbDocument.bookingId,
      uploadedById: typeof dbDocument.uploadedBy === 'string'
        ? dbDocument.uploadedBy
        : dbDocument.uploadedBy?.id || dbDocument.uploadedBy,
      uploadedBy: typeof dbDocument.uploadedBy === 'object' && dbDocument.uploadedBy?.id
        ? {
            id: dbDocument.uploadedBy.id,
            name: dbDocument.uploadedBy.name || 'Unknown User',
            email: dbDocument.uploadedBy.email || '',
          }
        : undefined,
      s3Key: dbDocument.s3Key,
      fileName: dbDocument.fileName,
      fileSize: dbDocument.fileSize,
      mimeType: dbDocument.mimeType,
      section: dbDocument.section,
      category: dbDocument.category,
      createdAt: dbDocument.createdAt,
      updatedAt: dbDocument.updatedAt || dbDocument.createdAt,
      deletedAt: dbDocument.deletedAt,
    };
  }
}

export const documentRepository = new DocumentRepository();