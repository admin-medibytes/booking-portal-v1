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
import { Loader2, CheckCircle2, PlusCircle, AlertCircle, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminClient } from "@/lib/hono-client";

interface AppointmentType {
  id: number;
  name: string;
  duration: number;
  category: string;
  formIds?: number[];
}

interface ComparisonResult {
  acuityTypes: AppointmentType[];
  existingTypes: AppointmentType[];
  newTypes: AppointmentType[];
  updatedTypes: AppointmentType[];
  typesWithForms: AppointmentType[];
  typesWithMissingForms: AppointmentType[];
  availableFormIds: number[];
}

interface AppointmentTypesSyncModalProps {
  open: boolean;
  onClose: () => void;
  onSync: () => void;
  onConfirmSync: (data: ComparisonResult) => Promise<void>;
}

type ModalState = "loading" | "preview" | "syncing" | "success" | "error";

export function AppointmentTypesSyncModal({
  open,
  onClose,
  onSync,
  onConfirmSync,
}: AppointmentTypesSyncModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview data when modal opens
  const fetchPreview = async () => {
    setState("loading");
    setError(null);

    try {
      const response = await adminClient.integration.acuity["appointment-types"].preview.$post();

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

  const getStatusIcon = (type: AppointmentType) => {
    const isNew = comparisonData?.newTypes.some((t) => t.id === type.id);
    const hasAllForms = !comparisonData?.typesWithMissingForms.some((t) => t.id === type.id);

    if (isNew) return <PlusCircle className="w-4 h-4 text-green-500" />;
    return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
  };

  const getFormStatus = (type: AppointmentType) => {
    if (!type.formIds || type.formIds.length === 0) {
      return <span className="text-muted-foreground text-sm">No forms</span>;
    }

    const availableForms = type.formIds.filter((id) =>
      comparisonData?.availableFormIds.includes(id)
    ).length;

    const totalForms = type.formIds.length;

    if (availableForms === totalForms) {
      return (
        <span className="flex items-center gap-1 text-green-600 text-sm">
          <Link2 className="w-3 h-3" />
          {totalForms} form{totalForms !== 1 ? "s" : ""} linked
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-yellow-600 text-sm">
        <Link2Off className="w-3 h-3" />
        {availableForms}/{totalForms} forms available
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:max-w-2xl px-0">
        <DialogHeader className="px-6">
          <DialogTitle>Sync Appointment Types</DialogTitle>
          <DialogDescription>
            {state === "loading" && "Fetching appointment types from Acuity..."}
            {state === "preview" && "Review the appointment types to be synced"}
            {state === "syncing" && "Syncing appointment types to database..."}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Found</p>
                  <p className="text-xl font-semibold">{comparisonData.acuityTypes.length}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-700">New</p>
                  <p className="text-xl font-semibold text-green-700">
                    {comparisonData.newTypes.length}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">Updates</p>
                  <p className="text-xl font-semibold text-blue-700">
                    {comparisonData.updatedTypes.length}
                  </p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-sm text-yellow-700">Missing Forms</p>
                  <p className="text-xl font-semibold text-yellow-700">
                    {comparisonData.typesWithMissingForms.length}
                  </p>
                </div>
              </div>

              {/* Appointment Types List */}
              <ScrollArea className="h-[60dvh] border-y">
                <div className="p-4 space-y-2">
                  {comparisonData.acuityTypes.map((type) => {
                    const isNew = comparisonData.newTypes.some((t) => t.id === type.id);

                    return (
                      <div
                        key={type.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isNew ? "bg-green-50/50" : "bg-background"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(type)}
                          <div>
                            <p className="font-medium">{type.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {type.duration} min
                              </Badge>
                              {type.category && (
                                <Badge variant="outline" className="text-xs">
                                  {type.category}
                                </Badge>
                              )}
                              {getFormStatus(type)}
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

              {comparisonData.typesWithMissingForms.length > 0 && (
                <div className="px-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {comparisonData.typesWithMissingForms.length} appointment type(s) have forms
                      that are not yet synced. Consider syncing forms first for complete data.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
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
