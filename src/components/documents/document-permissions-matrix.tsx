import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, Eye } from "lucide-react";

type DocumentPermissions = {
  [key: string]: string[];
};

type RolePermission = {
  role: string;
  permissions: DocumentPermissions;
};

export function DocumentPermissionsMatrix() {
  const permissions: RolePermission[] = [
    {
      role: "Referrer",
      permissions: {
        "Consent Form": ["upload", "download", "delete"],
        "Document Brief": ["upload", "download", "delete"],
        "Dictation": [],
        "Draft Report": [],
        "Final Report": ["download-pdf"],
      },
    },
    {
      role: "Specialist",
      permissions: {
        "Consent Form": [],
        "Document Brief": ["download"],
        "Dictation": ["upload", "download", "delete"],
        "Draft Report": ["upload", "download", "delete"],
        "Final Report": ["upload", "download", "delete"],
      },
    },
    {
      role: "Organization Owner/Manager",
      permissions: {
        "Consent Form": ["upload", "download", "delete"],
        "Document Brief": ["upload", "download", "delete"],
        "Dictation": ["upload", "download", "delete"],
        "Draft Report": ["upload", "download", "delete"],
        "Final Report": ["upload", "download", "delete"],
      },
    },
    {
      role: "Team Lead",
      permissions: {
        "Consent Form": ["download"],
        "Document Brief": ["download"],
        "Dictation": ["download"],
        "Draft Report": ["download"],
        "Final Report": ["download"],
      },
    },
  ];

  const documentTypes = [
    "Consent Form",
    "Document Brief",
    "Dictation",
    "Draft Report",
    "Final Report",
  ];

  const getPermissionIcon = (permissions: string[], action: string) => {
    if (action === "download" && permissions.includes("download-pdf")) {
      return (
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4 text-blue-600" />
          <span className="text-xs text-gray-500">PDF</span>
        </div>
      );
    }
    if (permissions.includes(action)) {
      return <Check className="h-4 w-4 text-green-600" />;
    }
    return <X className="h-4 w-4 text-gray-300" />;
  };

  return (
    <div className="space-y-4">
      <div className="prose prose-sm max-w-none">
        <h3 className="text-lg font-semibold">Document Access by Role</h3>
        <p className="text-sm text-muted-foreground">
          This table shows which document types each role can upload, download, and delete.
        </p>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Role / Document Type</TableHead>
              <TableHead className="text-center">Upload</TableHead>
              <TableHead className="text-center">Download</TableHead>
              <TableHead className="text-center">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((roleData) => (
              <React.Fragment key={roleData.role}>
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={4} className="font-medium">
                    {roleData.role}
                  </TableCell>
                </TableRow>
                {documentTypes.map((docType) => (
                  <TableRow key={`${roleData.role}-${docType}`}>
                    <TableCell className="pl-8">{docType}</TableCell>
                    <TableCell className="text-center">
                      {getPermissionIcon(roleData.permissions[docType] || [], "upload")}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPermissionIcon(roleData.permissions[docType] || [], "download")}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPermissionIcon(roleData.permissions[docType] || [], "delete")}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="space-y-2 text-sm">
        <h4 className="font-medium">Access Rules:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>• <strong>Referrers</strong> can only access documents for their own bookings</li>
          <li>• <strong>Specialists</strong> can only access documents for bookings they are assigned to</li>
          <li>• <strong>Organization Owners/Managers</strong> can access all documents within their organization</li>
          <li>• <strong>Team Leads</strong> can access documents for bookings created by their team members</li>
          <li>• <strong>Admins</strong> can access documents only when impersonating a referrer</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          <Eye className="inline h-3 w-3 mr-1" />
          PDF indicates that final reports are converted to PDF format for referrers
        </p>
      </div>
    </div>
  );
}

export default DocumentPermissionsMatrix;