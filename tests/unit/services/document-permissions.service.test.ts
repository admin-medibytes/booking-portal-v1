import { describe, it, expect } from "vitest";
import { documentPermissionsService } from "@/server/services/document-permissions.service";

describe("DocumentPermissionsService", () => {
  describe("hasPermission", () => {
    describe("Referrer permissions", () => {
      it("should allow referrers to upload consent forms", () => {
        const result = documentPermissionsService.hasPermission({
          role: "referrer",
          category: "consent_form",
          permission: "upload",
        });
        expect(result).toBe(true);
      });

      it("should allow referrers to upload document briefs", () => {
        const result = documentPermissionsService.hasPermission({
          role: "referrer",
          category: "document_brief",
          permission: "upload",
        });
        expect(result).toBe(true);
      });

      it("should not allow referrers to upload dictations", () => {
        const result = documentPermissionsService.hasPermission({
          role: "referrer",
          category: "dictation",
          permission: "upload",
        });
        expect(result).toBe(false);
      });

      it("should allow referrers to download final reports only", () => {
        const downloadResult = documentPermissionsService.hasPermission({
          role: "referrer",
          category: "final_report",
          permission: "download",
        });
        expect(downloadResult).toBe(true);

        const uploadResult = documentPermissionsService.hasPermission({
          role: "referrer",
          category: "final_report",
          permission: "upload",
        });
        expect(uploadResult).toBe(false);
      });
    });

    describe("Specialist permissions", () => {
      it("should not allow specialists to access consent forms", () => {
        const result = documentPermissionsService.hasPermission({
          role: "specialist",
          category: "consent_form",
          permission: "download",
        });
        expect(result).toBe(false);
      });

      it("should allow specialists to upload dictations", () => {
        const result = documentPermissionsService.hasPermission({
          role: "specialist",
          category: "dictation",
          permission: "upload",
        });
        expect(result).toBe(true);
      });

      it("should allow specialists to manage reports", () => {
        const uploadDraft = documentPermissionsService.hasPermission({
          role: "specialist",
          category: "draft_report",
          permission: "upload",
        });
        const uploadFinal = documentPermissionsService.hasPermission({
          role: "specialist",
          category: "final_report",
          permission: "upload",
        });
        const deleteDraft = documentPermissionsService.hasPermission({
          role: "specialist",
          category: "draft_report",
          permission: "delete",
        });

        expect(uploadDraft).toBe(true);
        expect(uploadFinal).toBe(true);
        expect(deleteDraft).toBe(true);
      });
    });

    describe("Admin permissions", () => {
      it("should allow admins full access to all document types", () => {
        const categories = ["consent_form", "document_brief", "dictation", "draft_report", "final_report"] as const;
        const permissions = ["upload", "download", "delete"] as const;

        categories.forEach((category) => {
          permissions.forEach((permission) => {
            const result = documentPermissionsService.hasPermission({
              role: "admin",
              category,
              permission,
            });
            expect(result).toBe(true);
          });
        });
      });
    });
  });

  describe("getDownloadFormat", () => {
    it("should return PDF-only for referrers downloading final reports", () => {
      const result = documentPermissionsService.getDownloadFormat("referrer", "final_report");
      expect(result.pdfOnly).toBe(true);
    });

    it("should return normal format for other cases", () => {
      const cases = [
        { role: "referrer", category: "document_brief" },
        { role: "specialist", category: "final_report" },
        { role: "admin", category: "final_report" },
      ] as const;

      cases.forEach(({ role, category }) => {
        const result = documentPermissionsService.getDownloadFormat(role, category);
        expect(result.pdfOnly).toBe(false);
      });
    });
  });

  describe("getAllowedCategories", () => {
    it("should return allowed categories for referrer upload", () => {
      const result = documentPermissionsService.getAllowedCategories("referrer", "upload");
      expect(result).toEqual(["consent_form", "document_brief"]);
    });

    it("should return allowed categories for specialist upload", () => {
      const result = documentPermissionsService.getAllowedCategories("specialist", "upload");
      expect(result).toEqual(["dictation", "draft_report", "final_report"]);
    });

    it("should return all categories for admin", () => {
      const result = documentPermissionsService.getAllowedCategories("admin", "upload");
      expect(result).toEqual(["consent_form", "document_brief", "dictation", "draft_report", "final_report"]);
    });
  });

  describe("getUserRole", () => {
    it("should map member roles correctly", () => {
      expect(documentPermissionsService.getUserRole("referrer")).toBe("referrer");
      expect(documentPermissionsService.getUserRole("specialist")).toBe("specialist");
      expect(documentPermissionsService.getUserRole("owner")).toBe("admin");
      expect(documentPermissionsService.getUserRole("manager")).toBe("admin");
      expect(documentPermissionsService.getUserRole("team_lead")).toBe("admin");
      expect(documentPermissionsService.getUserRole(undefined)).toBe("referrer");
      expect(documentPermissionsService.getUserRole("unknown")).toBe("referrer");
    });
  });

  describe("getAvailableCategoriesForSection", () => {
    it("should return all categories for IME documents", () => {
      const result = documentPermissionsService.getAvailableCategoriesForSection("referrer", "ime_documents");
      expect(result).toEqual(["consent_form", "document_brief"]);
    });

    it("should exclude consent_form for supplementary documents", () => {
      const result = documentPermissionsService.getAvailableCategoriesForSection("referrer", "supplementary_documents");
      expect(result).toEqual(["document_brief"]);
    });

    it("should respect role permissions", () => {
      const specialistIME = documentPermissionsService.getAvailableCategoriesForSection("specialist", "ime_documents");
      expect(specialistIME).toEqual(["dictation", "draft_report", "final_report"]);

      const specialistSupp = documentPermissionsService.getAvailableCategoriesForSection("specialist", "supplementary_documents");
      expect(specialistSupp).toEqual(["dictation", "draft_report", "final_report"]);
    });
  });
});