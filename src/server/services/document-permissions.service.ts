import type { DocumentCategory } from "@/types/document";

type UserRole = "referrer" | "specialist" | "admin";
type Permission = "upload" | "download" | "delete";

interface PermissionCheck {
  role: UserRole;
  category: DocumentCategory;
  permission: Permission;
}

interface DownloadFormat {
  pdfOnly: boolean;
}

export class DocumentPermissionsService {
  private permissionMatrix: Record<UserRole, Record<DocumentCategory, Permission[]>> = {
    referrer: {
      consent_form: ["upload", "download", "delete"],
      document_brief: ["upload", "download", "delete"],
      dictation: [],
      draft_report: [],
      final_report: ["download"],
    },
    specialist: {
      consent_form: [],
      document_brief: ["download"],
      dictation: ["upload", "download", "delete"],
      draft_report: ["upload", "download", "delete"],
      final_report: ["upload", "download", "delete"],
    },
    admin: {
      consent_form: ["upload", "download", "delete"],
      document_brief: ["upload", "download", "delete"],
      dictation: ["upload", "download", "delete"],
      draft_report: ["upload", "download", "delete"],
      final_report: ["upload", "download", "delete"],
    },
  };

  hasPermission({ role, category, permission }: PermissionCheck): boolean {
    const rolePermissions = this.permissionMatrix[role];
    if (!rolePermissions) {
      return false;
    }

    const categoryPermissions = rolePermissions[category];
    if (!categoryPermissions) {
      return false;
    }

    return categoryPermissions.includes(permission);
  }

  getDownloadFormat(role: UserRole, category: DocumentCategory): DownloadFormat {
    // Referrers can only download final reports as PDF
    if (role === "referrer" && category === "final_report") {
      return { pdfOnly: true };
    }
    return { pdfOnly: false };
  }

  getAllowedCategories(role: UserRole, permission: Permission): DocumentCategory[] {
    const rolePermissions = this.permissionMatrix[role];
    if (!rolePermissions) {
      return [];
    }

    return Object.entries(rolePermissions)
      .filter(([, permissions]) => permissions.includes(permission))
      .map(([category]) => category as DocumentCategory);
  }

  getUserRole(memberRole: string | undefined): UserRole {
    // Map member roles to document permission roles
    switch (memberRole) {
      case "admin":
        return "admin";
      case "referrer":
        return "referrer";
      case "specialist":
        return "specialist";
      case "owner":
      case "manager":
      case "team_lead":
        return "admin";
      default:
        // Default to most restrictive if role unknown
        return "referrer";
    }
  }

  getAvailableCategoriesForSection(
    role: UserRole,
    section: "ime_documents" | "supplementary_documents"
  ): DocumentCategory[] {
    const allCategories = this.getAllowedCategories(role, "upload");

    if (section === "ime_documents") {
      // All categories are available in IME Documents
      return allCategories;
    } else {
      // Supplementary Documents excludes consent_form
      return allCategories.filter((cat) => cat !== "consent_form");
    }
  }
}

export const documentPermissionsService = new DocumentPermissionsService();
