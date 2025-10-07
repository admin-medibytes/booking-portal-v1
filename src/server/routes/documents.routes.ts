import { Hono } from "hono";
import { type } from "arktype";
import { documentService } from "@/server/services/document.service";
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import {
  authMiddleware,
  requireAuth,
  checkImpersonation,
} from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import {
  documentUploadRateLimit,
  createRateLimiter,
} from "@/server/middleware/rate-limit.middleware";
import { convertToPdf } from "@/lib/pdf-converter";
import type { DocumentCategory } from "@/types/document";

// Create download rate limiter - 100 downloads per hour per user
const documentDownloadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 downloads per hour
  keyPrefix: "document-download",
  skip: (c) => {
    const authContext = c.get("auth");
    const userRoles = authContext?.user?.role?.split(",").map((r) => r.trim()) || [];
    return userRoles.includes("admin");
  },
});

const documentsRoutes = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAuth)
  .use("*", checkImpersonation)

  // Initiate upload - Generate presigned URL
  .post(
    "/initiate-upload",
    documentUploadRateLimit,
    arktypeValidator(
      "json",
      type({
        bookingId: "string",
        fileName: "string",
        fileSize: "number",
        mimeType: "string",
        section: "'ime_documents' | 'supplementary_documents'",
        category:
          "'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const body = await c.req.json();
        const memberRole =
          "user" in authContext && authContext.user && "memberRole" in authContext.user
            ? (authContext.user as { memberRole?: string }).memberRole
            : undefined;

        const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
        const userAgent = c.req.header("user-agent");

        const result = await documentService.initiateUpload(
          {
            bookingId: body.bookingId,
            uploadedById: user.id,
            fileName: body.fileName,
            fileSize: body.fileSize,
            mimeType: body.mimeType,
            section: body.section,
            category: body.category,
          },
          {
            ipAddress,
            userAgent,
            userRole: memberRole,
          }
        );

        return c.json({ data: result });
      } catch (error) {
        console.error("Initiate upload error:", error);
        if (error instanceof Error) {
          return c.json({ error: error.message }, 400);
        }
        return c.json({ error: "Failed to initiate upload" }, 500);
      }
    }
  )

  // Confirm upload - Save document metadata after S3 upload
  .post(
    "/confirm-upload",
    arktypeValidator(
      "json",
      type({
        documentId: "string",
        s3Key: "string",
        bookingId: "string",
        fileName: "string",
        fileSize: "number",
        mimeType: "string",
        section: "'ime_documents' | 'supplementary_documents'",
        category:
          "'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const body = await c.req.json();
        const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
        const userAgent = c.req.header("user-agent");

        const document = await documentService.confirmUpload(
          body.documentId,
          body.s3Key,
          {
            bookingId: body.bookingId,
            uploadedById: user.id,
            fileName: body.fileName,
            fileSize: body.fileSize,
            mimeType: body.mimeType,
            section: body.section,
            category: body.category,
          },
          {
            ipAddress,
            userAgent,
          }
        );

        return c.json({ data: document });
      } catch (error) {
        console.error("Confirm upload error:", error);
        if (error instanceof Error) {
          return c.json({ error: error.message }, 400);
        }
        return c.json({ error: "Failed to confirm upload" }, 500);
      }
    }
  )

  // Direct file upload endpoint (server-side upload to S3)
  .post(
    "/upload",
    documentUploadRateLimit,
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const formData = await c.req.formData();
        const bookingId = formData.get("bookingId") as string;
        const section = formData.get("section") as "ime_documents" | "supplementary_documents";
        const category = formData.get("category") as DocumentCategory;

        if (!bookingId || !section || !category) {
          return c.json({ error: "Missing required fields" }, 400);
        }

        const memberRole =
          "user" in authContext && authContext.user && "memberRole" in authContext.user
            ? (authContext.user as { memberRole?: string }).memberRole
            : undefined;

        const uploadResults = [];
        const fileEntries = formData.getAll("files");

        if (fileEntries.length === 0) {
          return c.json({ error: "No files provided" }, 400);
        }

        const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
        const userAgent = c.req.header("user-agent");

        for (const fileEntry of fileEntries) {
          const file = fileEntry as File;
          if (!file) continue;

          try {
            const fileBuffer = Buffer.from(await file.arrayBuffer());

            const document = await documentService.uploadDocumentDirect({
              bookingId,
              uploadedById: user.id,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              section,
              category,
              fileBuffer,
              userRole: memberRole,
              ipAddress,
              userAgent,
            });

            uploadResults.push({
              id: document.id,
              name: document.fileName,
              uploadSuccess: true,
            });
          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            uploadResults.push({
              name: file.name,
              uploadSuccess: false,
              error: error instanceof Error ? error.message : "Unknown error during upload",
            });
          }
        }

        return c.json({
          totalFiles: fileEntries.length,
          successfulUploads: uploadResults.filter((r) => r.uploadSuccess).length,
          failedUploads: uploadResults.filter((r) => !r.uploadSuccess).length,
          files: uploadResults,
        });
      } catch (error) {
        console.error("Document upload error:", error);
        return c.json({ error: "Failed to upload documents" }, 500);
      }
    }
  )

  .get("/:id", documentDownloadRateLimit, async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      const session = authContext?.session;

      // Enhanced session validation
      if (!user || !session) {
        return c.json({ error: "Unauthorized", redirect: "/login" }, 401);
      }

      // Check for expired session
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return c.json({ error: "Session expired", redirect: "/login" }, 401);
      }

      const documentId = c.req.param("id");
      const memberRole =
        "user" in authContext && authContext.user && "memberRole" in authContext.user
          ? (authContext.user as { memberRole?: string }).memberRole
          : undefined;
      const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
      const userAgent = c.req.header("user-agent") || "unknown";
      const rangeHeader = c.req.header("range");

      // Parse range header if present
      let range: { start: number; end: number } | undefined;
      if (rangeHeader) {
        const matches = rangeHeader.match(/bytes=(\d+)-(\d*)?/);
        if (matches) {
          const start = parseInt(matches[1], 10);
          const end = matches[2] ? parseInt(matches[2], 10) : undefined;
          range = { start, end: end || start + 1024 * 1024 - 1 }; // Default 1MB chunks
        }
      }

      // Get download with comprehensive permission validation
      const impersonatedUserId = session.impersonatedBy || undefined;
      const downloadResult = await documentService.downloadDocument(documentId, user.id, {
        impersonatedUserId,
        ipAddress,
        userAgent,
        range,
        userRole: memberRole,
      });

      const { stream, document, contentLength, contentRange, acceptRanges } = downloadResult;

      if (!stream) {
        return c.json({ error: "Document not found" }, 404);
      }

      // Check if referrer needs PDF-only download for final reports
      const role = documentPermissionsService.getUserRole(memberRole);
      const downloadFormat = documentPermissionsService.getDownloadFormat(role, document.category);

      if (downloadFormat.pdfOnly && document.mimeType !== "application/pdf") {
        // Convert to PDF for referrers downloading final reports
        const pdfStream = await convertToPdf(stream, document.mimeType, document.fileName);
        c.header("Content-Type", "application/pdf");
        c.header(
          "Content-Disposition",
          `attachment; filename="${sanitizeFilename(document.fileName.replace(/\.[^.]+$/, ".pdf"))}"`
        );
        return c.body(pdfStream);
      }

      // Set secure headers for normal download
      c.header("Content-Type", document.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="${sanitizeFilename(document.fileName)}"`
      );
      c.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
      c.header("X-Content-Type-Options", "nosniff");
      c.header("X-Frame-Options", "DENY");

      // Set range headers if applicable
      if (acceptRanges) {
        c.header("Accept-Ranges", acceptRanges);
      }

      if (contentRange) {
        c.status(206); // Partial Content
        c.header("Content-Range", contentRange);
        c.header("Content-Length", contentLength?.toString() || "0");
      } else {
        c.header("Content-Length", document.fileSize.toString());
      }

      return c.body(stream);
    } catch (error) {
      console.error("Document download error:", error);

      if (error instanceof Error) {
        // Handle specific error cases without exposing internals
        switch (error.message) {
          case "Document not found":
            return c.json({ error: "Document not found" }, 404);
          case "Access denied":
            return c.json(
              {
                error: "Access denied",
                message: "You do not have permission to access this document",
              },
              403
            );
          case "Session expired":
            return c.json({ error: "Session expired", redirect: "/login" }, 401);
          default:
            // Log error details but don't expose them
            console.error("Unexpected download error:", error.stack);
            return c.json({ error: "Failed to download document" }, 500);
        }
      }

      return c.json({ error: "Failed to download document" }, 500);
    }
  })

  .delete("/:id", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const documentId = c.req.param("id");
      const memberRole =
        "user" in authContext && authContext.user && "memberRole" in authContext.user
          ? (authContext.user as { memberRole?: string }).memberRole
          : undefined;
      const session = authContext?.session;
      const impersonatedUserId = session?.impersonatedBy || undefined;
      await documentService.deleteDocument(documentId, user.id, {
        userRole: memberRole,
        impersonatedUserId,
      });

      return c.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Document deletion error:", error);

      if (error instanceof Error && error.message === "Document not found") {
        return c.json({ error: "Document not found" }, 404);
      }

      if (error instanceof Error && error.message === "Access denied") {
        return c.json(
          {
            error: "Access denied",
            message: "You do not have permission to delete this document",
          },
          403
        );
      }

      if (error instanceof Error && error.message.includes("do not have permission")) {
        return c.json(
          {
            error: "Permission denied",
            message: error.message,
          },
          403
        );
      }

      return c.json({ error: "Failed to delete document" }, 500);
    }
  })

  .get(
    "/booking/:bookingId",
    arktypeValidator("param", type({ bookingId: "string" })),
    arktypeValidator(
      "query",
      type({
        section: "'ime_documents' | 'supplementary_documents' | undefined",
        category:
          "'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report' | undefined",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const bookingId = c.req.param("bookingId");
        const section = c.req.query("section") as
          | "ime_documents"
          | "supplementary_documents"
          | undefined;
        const category = c.req.query("category") as DocumentCategory | undefined;
        const memberRole =
          "user" in authContext && authContext.user && "memberRole" in authContext.user
            ? (authContext.user as { memberRole?: string }).memberRole
            : undefined;
        const session = authContext?.session;
        const impersonatedUserId = session?.impersonatedBy || undefined;

        const documents = await documentService.getDocumentsByBooking(bookingId, user.id, {
          section,
          category,
          userRole: memberRole,
          impersonatedUserId,
        });

        return c.json({ data: documents });
      } catch (error) {
        console.error("Document list error:", error);

        if (error instanceof Error && error.message === "Access denied") {
          return c.json(
            {
              error: "Access denied",
              message: "You do not have permission to view documents for this booking",
            },
            403
          );
        }

        return c.json({ error: "Failed to fetch documents" }, 500);
      }
    }
  );

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts and special characters
  return filename
    .replace(/[\/\\]/g, "_") // Replace slashes
    .replace(/\.\.+/g, ".") // Remove multiple dots
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Keep only safe characters
    .slice(0, 255); // Limit length
}

export { documentsRoutes };
