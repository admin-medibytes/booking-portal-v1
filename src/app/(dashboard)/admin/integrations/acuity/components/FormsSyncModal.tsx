"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, PlusCircle, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminClient } from "@/lib/hono-client";

interface FormField {
  id: number;
  name: string;
  required?: boolean;
  type: "textbox" | "textarea" | "dropdown" | "checkbox" | "checkboxlist" | "yesno" | "file";
  options?: string[];
}

interface Form {
  id: number;
  name: string;
  description?: string;
  hidden?: boolean;
  appointmentTypeIDs?: number[];
  fields?: FormField[];
}

interface ComparisonResult {
  acuityForms: Form[];
  existingForms: Form[];
  newForms: Form[];
  updatedForms: Form[];
}

interface FormsSyncModalProps {
  open: boolean;
  onClose: () => void;
  onSync: () => void;
  onConfirmSync: (data: ComparisonResult) => Promise<void>;
}

type ModalState = "loading" | "preview" | "syncing" | "success" | "error";

export function FormsSyncModal({ open, onClose, onSync, onConfirmSync }: FormsSyncModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview data when modal opens
  const fetchPreview = async () => {
    setState("loading");
    setError(null);

    try {
      const response = await adminClient.integration.acuity.forms.preview.$post();

      if (!response.ok) {
        throw new Error("Failed to fetch preview");
      }

      const data = await response.json();
      if ("success" in data && data.success) {
        setComparisonData(data as any);
        setState("preview");
      } else {
        throw new Error((data as any).error || "Failed to fetch preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  // Handle sync confirmation
  const handleConfirmSync = async () => {
    if (!comparisonData) return;

    setState("syncing");
    try {
      await onConfirmSync(comparisonData);
      setState("success");
      setTimeout(() => {
        onClose();
        onSync(); // Refresh the list
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setState("error");
    }
  };

  // Trigger fetch when modal opens
  useEffect(() => {
    if (open) {
      fetchPreview();
    } else {
      // Reset state when modal closes
      setComparisonData(null);
      setState("loading");
      setError(null);
    }
  }, [open]);

  const getStatusIcon = (form: Form) => {
    const isNew = comparisonData?.newForms.some((f) => f.id === form.id);

    if (isNew) return <PlusCircle className="w-4 h-4 text-green-500" />;
    return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:max-w-2xl px-0">
        <DialogHeader className="px-6">
          <DialogTitle>Sync Forms</DialogTitle>
          <DialogDescription>
            {state === "loading" && "Fetching forms from Acuity..."}
            {state === "preview" && "Review the forms to be synced"}
            {state === "syncing" && "Syncing forms to database..."}
            {state === "success" && "Sync completed successfully!"}
            {state === "error" && "An error occurred during sync"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 px-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Fetching from Acuity...</p>
            </div>
          )}

          {state === "preview" && comparisonData && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-6">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Found</p>
                  <p className="text-xl font-semibold">{comparisonData.acuityForms.length}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-700">New</p>
                  <p className="text-xl font-semibold text-green-700">
                    {comparisonData.newForms.length}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">Updates</p>
                  <p className="text-xl font-semibold text-blue-700">
                    {comparisonData.updatedForms.length}
                  </p>
                </div>
              </div>

              {/* Forms List */}
              <ScrollArea className="h-[60dvh] border-y">
                <div className="p-4 space-y-2">
                  {comparisonData.acuityForms.map((form) => {
                    const isNew = comparisonData.newForms.some((f) => f.id === form.id);

                    return (
                      <div
                        key={form.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isNew ? "bg-green-50/50" : "bg-background"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(form)}
                          <div>
                            <p className="font-medium">{form.name}</p>
                            {form.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {form.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {form.fields && (
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {form.fields.length} fields
                                </Badge>
                              )}
                              {form.hidden && (
                                <Badge variant="secondary" className="text-xs">
                                  Hidden
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant={isNew ? "success" : "secondary"}>
                          {isNew ? "New" : "Update"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {state === "syncing" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Syncing to database...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-lg font-medium">Sync completed successfully!</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium">Sync failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6">
          {state === "preview" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSync}>Confirm Sync</Button>
            </>
          )}
          {state === "error" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={fetchPreview}>Retry</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
