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
  const isSpecialist = !isLoading && user?.memberRole === "specialist";
  const isReferrer = !isLoading && user?.memberRole === "referrer";
  // const isAdminOrOwner = user?.role === "admin" || user?.memberRole === "owner";

  // Specialists: can view consent form but not upload/delete
  const shouldDisableUploadForSpecialist = isLoading || !user?.memberRole || isSpecialist;
  const shouldDisableDeleteForSpecialist = isLoading || !user?.memberRole || isSpecialist;

  // Referrers: hide specialist-only documents, disable upload/delete on final reports
  const shouldHideForReferrer = isLoading || !user?.memberRole || isReferrer;
  const shouldDisableForReferrer = isLoading || !user?.memberRole || isReferrer;
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
            {/* Consent Form - Referrer: upload/delete, Specialist: view only */}
            <DocumentUploadField
              label="Consent Form"
              bookingId={bookingId}
              section="ime_documents"
              category="consent_form"
              disableUpload={shouldDisableUploadForSpecialist}
              disableDelete={shouldDisableDeleteForSpecialist}
            />
            {/* Brief Documents - Referrer: upload/delete, Specialist: hidden */}
            <DocumentUploadField
              label="Brief Documents"
              bookingId={bookingId}
              section="ime_documents"
              category="document_brief"
              hidden={isSpecialist}
            />
            {/* Dictation - Referrer: hidden, Specialist: upload/delete */}
            <DocumentUploadField
              label="Dictation"
              bookingId={bookingId}
              section="ime_documents"
              category="dictation"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.wma,.webm,.docx,.doc,.pdf"
              hidden={shouldHideForReferrer}
            />
            {/* Draft Reports - Referrer: hidden, Specialist: upload/delete */}
            <DocumentUploadField
              label="Draft Reports"
              bookingId={bookingId}
              section="ime_documents"
              category="draft_report"
              hidden={shouldHideForReferrer}
            />
            {/* Final Report - Referrer: download only, Specialist: upload/delete */}
            <DocumentUploadField
              label="Final Report"
              bookingId={bookingId}
              section="ime_documents"
              category="final_report"
              disableUpload={shouldDisableForReferrer}
              disableDelete={shouldDisableForReferrer}
            />
          </TabsContent>

          <TabsContent value="supplementary" className="space-y-4 mt-4">
            {/* Supplementary Brief Documents - Referrer: upload/delete, Specialist: hidden */}
            <DocumentUploadField
              label="Supplementary Brief Documents"
              bookingId={bookingId}
              section="supplementary_documents"
              category="document_brief"
              hidden={isSpecialist}
            />
            {/* Supplementary Dictation - Referrer: hidden, Specialist: upload/delete */}
            <DocumentUploadField
              label="Supplementary Dictation"
              bookingId={bookingId}
              section="supplementary_documents"
              category="dictation"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.wma,.webm,.docx,.doc,.pdf"
              hidden={shouldHideForReferrer}
            />
            {/* Supplementary Draft Reports - Referrer: hidden, Specialist: upload/delete */}
            <DocumentUploadField
              label="Supplementary Draft Reports"
              bookingId={bookingId}
              section="supplementary_documents"
              category="draft_report"
              hidden={shouldHideForReferrer}
            />
            {/* Supplementary Final Report - Referrer: download only, Specialist: upload/delete */}
            <DocumentUploadField
              label="Supplementary Final Report"
              bookingId={bookingId}
              section="supplementary_documents"
              category="final_report"
              disableUpload={shouldDisableForReferrer}
              disableDelete={shouldDisableForReferrer}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
