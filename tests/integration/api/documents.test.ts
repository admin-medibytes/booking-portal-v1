import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { documentsRoutes } from "@/server/routes/documents.routes";
import { documentService } from "@/server/services/document.service";
import { documentPermissionsService } from "@/server/services/document-permissions.service";

// Mock the services
vi.mock("@/server/services/document.service");
vi.mock("@/server/services/audit.service");
vi.mock("@/lib/s3");

describe("Documents API - Role-based Access", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api/documents", documentsRoutes);
    vi.clearAllMocks();
  });

  const createAuthContext = (role: string) => ({
    auth: {
      user: { id: "user-123", name: "Test User", memberRole: role },
      session: { id: "session-123", expiresAt: new Date(Date.now() + 3600000) },
    },
    memberRole: role,
  });

  describe("POST /api/documents - Upload permissions", () => {
    it("should allow referrers to upload consent forms", async () => {
      const mockDocument = {
        id: "doc-123",
        bookingId: "booking-123",
        category: "consent_form",
        section: "ime_documents",
      };

      vi.mocked(documentService.uploadDocument).mockResolvedValueOnce(mockDocument as any);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "application/pdf" }), "consent.pdf");
      formData.append("metadata", JSON.stringify({
        bookingId: "booking-123",
        section: "ime_documents",
        category: "consent_form",
        fileName: "consent.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      }));

      const response = await app.request("/api/documents", {
        method: "POST",
        body: formData,
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: mockDocument });
    });

    it("should prevent referrers from uploading dictations", async () => {
      vi.mocked(documentService.uploadDocument).mockRejectedValueOnce(
        new Error("You do not have permission to upload this document type")
      );

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "audio/mpeg" }), "dictation.mp3");
      formData.append("metadata", JSON.stringify({
        bookingId: "booking-123",
        section: "ime_documents",
        category: "dictation",
        fileName: "dictation.mp3",
        fileSize: 1024,
        mimeType: "audio/mpeg",
      }));

      const response = await app.request("/api/documents", {
        method: "POST",
        body: formData,
      }, createAuthContext("referrer"));

      expect(response.status).toBe(500);
    });

    it("should allow specialists to upload reports", async () => {
      const mockDocument = {
        id: "doc-124",
        bookingId: "booking-123",
        category: "draft_report",
        section: "ime_documents",
      };

      vi.mocked(documentService.uploadDocument).mockResolvedValueOnce(mockDocument as any);

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "application/pdf" }), "report.pdf");
      formData.append("metadata", JSON.stringify({
        bookingId: "booking-123",
        section: "ime_documents",
        category: "draft_report",
        fileName: "report.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      }));

      const response = await app.request("/api/documents", {
        method: "POST",
        body: formData,
      }, createAuthContext("specialist"));

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/documents/:id - Download permissions", () => {
    it("should allow download based on permissions", async () => {
      const mockDocument = {
        id: "doc-123",
        bookingId: "booking-123",
        category: "document_brief",
        mimeType: "application/pdf",
        fileName: "brief.pdf",
        fileSize: 1024,
      };

      vi.mocked(documentService.downloadDocument).mockResolvedValueOnce({
        stream: new ReadableStream(),
        document: mockDocument as any,
      });

      const response = await app.request("/api/documents/doc-123", {
        method: "GET",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("should convert final reports to PDF for referrers", async () => {
      const mockDocument = {
        id: "doc-125",
        bookingId: "booking-123",
        category: "final_report",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: "final_report.docx",
        fileSize: 2048,
      };

      vi.mocked(documentService.downloadDocument).mockResolvedValueOnce({
        stream: new ReadableStream(),
        document: mockDocument as any,
      });

      const response = await app.request("/api/documents/doc-125", {
        method: "GET",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      // Should attempt PDF conversion for referrer downloading final report
      expect(documentPermissionsService.getDownloadFormat("referrer", "final_report").pdfOnly).toBe(true);
    });
  });

  describe("DELETE /api/documents/:id - Delete permissions", () => {
    it("should allow referrers to delete their uploaded documents", async () => {
      vi.mocked(documentService.deleteDocument).mockResolvedValueOnce(undefined);

      const response = await app.request("/api/documents/doc-123", {
        method: "DELETE",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Document deleted successfully" });
    });

    it("should handle permission denied errors", async () => {
      vi.mocked(documentService.deleteDocument).mockRejectedValueOnce(
        new Error("You do not have permission to delete this document type")
      );

      const response = await app.request("/api/documents/doc-123", {
        method: "DELETE",
      }, createAuthContext("specialist"));

      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/documents/booking/:bookingId - List with filters", () => {
    it("should filter documents by section", async () => {
      const mockDocuments = [
        { id: "doc-1", section: "ime_documents", category: "consent_form" },
        { id: "doc-2", section: "ime_documents", category: "document_brief" },
      ];

      vi.mocked(documentService.getDocumentsByBooking).mockResolvedValueOnce(mockDocuments as any);

      const response = await app.request("/api/documents/booking/booking-123?section=ime_documents", {
        method: "GET",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: mockDocuments });
      expect(documentService.getDocumentsByBooking).toHaveBeenCalledWith(
        "booking-123",
        "user-123",
        expect.objectContaining({ section: "ime_documents" })
      );
    });

    it("should filter documents by category", async () => {
      const mockDocuments = [
        { id: "doc-1", section: "ime_documents", category: "consent_form" },
      ];

      vi.mocked(documentService.getDocumentsByBooking).mockResolvedValueOnce(mockDocuments as any);

      const response = await app.request("/api/documents/booking/booking-123?category=consent_form", {
        method: "GET",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(documentService.getDocumentsByBooking).toHaveBeenCalledWith(
        "booking-123",
        "user-123",
        expect.objectContaining({ category: "consent_form" })
      );
    });

    it("should respect role-based filtering", async () => {
      const mockDocuments = [
        { id: "doc-1", category: "document_brief" },
        { id: "doc-2", category: "final_report" },
      ];

      vi.mocked(documentService.getDocumentsByBooking).mockResolvedValueOnce(mockDocuments as any);

      const response = await app.request("/api/documents/booking/booking-123", {
        method: "GET",
      }, createAuthContext("referrer"));

      expect(response.status).toBe(200);
      expect(documentService.getDocumentsByBooking).toHaveBeenCalledWith(
        "booking-123",
        "user-123",
        expect.objectContaining({ userRole: "referrer" })
      );
    });
  });
});