"use client";

import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUploadField } from "./document-upload-field";
import { useAuth } from "@/hooks/use-auth";

interface BookingDocumentsSectionProps {
  bookingId: string;
}

export function BookingDocumentsSection({ bookingId }: BookingDocumentsSectionProps) {
  const { user, isLoading } = useAuth();
  const isSpecialist = user?.memberRole === "specialist";
  const shouldDisableUpload = isLoading || isSpecialist;
  const shouldDisableDelete = isLoading || isSpecialist;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ime" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ime">IME</TabsTrigger>
            <TabsTrigger value="supplementary">Supplementary</TabsTrigger>
          </TabsList>

          <TabsContent value="ime" className="space-y-4 mt-4">
            <DocumentUploadField
              label="Consent Form"
              bookingId={bookingId}
              section="ime_documents"
              category="consent_form"
              disableUpload={shouldDisableUpload}
              disableDelete={shouldDisableDelete}
            />
            <DocumentUploadField
              label="Brief Documents"
              bookingId={bookingId}
              section="ime_documents"
              category="document_brief"
              disableUpload={shouldDisableUpload}
              disableDelete={shouldDisableDelete}
            />
            <DocumentUploadField
              label="Dictation"
              bookingId={bookingId}
              section="ime_documents"
              category="dictation"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.wma,.webm,.docx,.doc,.pdf"
            />
            <DocumentUploadField
              label="Draft Reports"
              bookingId={bookingId}
              section="ime_documents"
              category="draft_report"
            />
            <DocumentUploadField
              label="Final Report"
              bookingId={bookingId}
              section="ime_documents"
              category="final_report"
            />
          </TabsContent>

          <TabsContent value="supplementary" className="space-y-4 mt-4">
            <DocumentUploadField
              label="Supplementary Brief Documents"
              bookingId={bookingId}
              section="supplementary_documents"
              category="document_brief"
              disableUpload={shouldDisableUpload}
              disableDelete={shouldDisableDelete}
            />
            <DocumentUploadField
              label="Supplementary Dictation"
              bookingId={bookingId}
              section="supplementary_documents"
              category="dictation"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.wma,.webm,.docx,.doc,.pdf"
            />
            <DocumentUploadField
              label="Supplementary Draft Reports"
              bookingId={bookingId}
              section="supplementary_documents"
              category="draft_report"
            />
            <DocumentUploadField
              label="Supplementary Final Report"
              bookingId={bookingId}
              section="supplementary_documents"
              category="final_report"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
