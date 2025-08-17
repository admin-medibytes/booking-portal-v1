import { Hono } from "hono";
import { type } from "arktype";
import { documentService } from "@/server/services/document.service";
import { authMiddleware, requireAuth } from "@/server/middleware/auth.middleware";
import { validateMiddleware } from "@/server/middleware/validate.middleware";
import { documentUploadRateLimit } from "@/server/middleware/rate-limit.middleware";
import { env } from "@/lib/env";

const documentsRoutes = new Hono();

documentsRoutes.use("*", authMiddleware);
documentsRoutes.use("*", requireAuth);

const MAX_FILE_SIZE = parseInt(env.S3_UPLOAD_MAX_SIZE || "104857600");

const uploadDocumentSchema = type({
  bookingId: "string",
  category: "'consent_form' | 'brief' | 'report' | 'dictation' | 'other'",
  fileName: "string",
  fileSize: "number",
  mimeType: "string",
});

documentsRoutes.post(
  "/",
  documentUploadRateLimit,
  validateMiddleware(uploadDocumentSchema),
  async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;
      const metadata = JSON.parse(formData.get("metadata") as string);

      if (!file) {
        return c.json({ error: "No file provided" }, 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return c.json(
          { error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes` },
          400
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const document = await documentService.uploadDocument({
        bookingId: metadata.bookingId,
        uploadedById: user.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category: metadata.category,
        fileBuffer,
      });

      return c.json({ data: document });
    } catch (error) {
      console.error("Document upload error:", error);
      return c.json({ error: "Failed to upload document" }, 500);
    }
  }
);

documentsRoutes.get("/:id", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const documentId = c.req.param("id");
    const { stream, document } = await documentService.downloadDocument(
      documentId,
      user.id
    );

    if (!stream) {
      return c.json({ error: "Document not found" }, 404);
    }

    c.header("Content-Type", document.mimeType);
    c.header("Content-Disposition", `attachment; filename="${document.fileName}"`);
    c.header("Content-Length", document.fileSize.toString());

    return c.body(stream);
  } catch (error) {
    console.error("Document download error:", error);
    
    if (error instanceof Error && error.message === "Document not found") {
      return c.json({ error: "Document not found" }, 404);
    }
    
    if (error instanceof Error && error.message === "Access denied") {
      return c.json({ error: "Access denied" }, 403);
    }
    
    return c.json({ error: "Failed to download document" }, 500);
  }
});

documentsRoutes.delete("/:id", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const documentId = c.req.param("id");
    await documentService.deleteDocument(documentId, user.id);

    return c.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Document deletion error:", error);
    
    if (error instanceof Error && error.message === "Document not found") {
      return c.json({ error: "Document not found" }, 404);
    }
    
    if (error instanceof Error && error.message === "Access denied") {
      return c.json({ error: "Access denied" }, 403);
    }
    
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

documentsRoutes.get("/booking/:bookingId", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const bookingId = c.req.param("bookingId");
    const documents = await documentService.getDocumentsByBooking(
      bookingId,
      user.id
    );

    return c.json({ data: documents });
  } catch (error) {
    console.error("Document list error:", error);
    return c.json({ error: "Failed to fetch documents" }, 500);
  }
});

export { documentsRoutes };