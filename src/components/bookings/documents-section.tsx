import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload } from "lucide-react";

interface DocumentsSectionProps {
  bookingId: string;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: Date;
  }>;
}

export function DocumentsSection({ bookingId: _bookingId, documents = [] }: DocumentsSectionProps) {
  const documentCount = documents.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
          </div>
          {documentCount > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {documentCount} document{documentCount !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documentCount === 0 ? (
          <div className="text-center py-8">
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-2">No documents uploaded</p>
            <p className="text-sm text-gray-400">
              Document upload functionality will be available in a future update.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.type}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}