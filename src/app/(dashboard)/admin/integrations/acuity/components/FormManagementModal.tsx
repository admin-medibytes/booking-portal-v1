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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText, CheckCircle2 } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { toast } from "sonner";

interface FormManagementModalProps {
  open: boolean;
  onClose: () => void;
  appointmentType: {
    id: number;
    name: string;
    formCount?: number;
  } | null;
  onUpdate: () => void;
}

interface FormOption {
  id: number;
  name: string;
  description?: string;
  fieldCount?: number;
  hidden?: boolean;
}

export function FormManagementModal({
  open,
  onClose,
  appointmentType,
  onUpdate,
}: FormManagementModalProps) {
  const [availableForms, setAvailableForms] = useState<FormOption[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<number>>(new Set());
  const [originalFormIds, setOriginalFormIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available forms and current associations
  const fetchData = async () => {
    if (!appointmentType) return;

    setIsLoading(true);
    try {
      // Fetch all available forms
      const formsResponse = await adminClient.integration.acuity.forms.$get();
      if (!formsResponse.ok) throw new Error("Failed to fetch forms");
      const formsData = await formsResponse.json();
      setAvailableForms(formsData.data);

      // Fetch current form associations for this appointment type
      const associationsResponse = await adminClient.integration.acuity["appointment-types"][
        ":id"
      ].forms.$get({
        param: { id: appointmentType.id.toString() },
      });

      if (!associationsResponse.ok) throw new Error("Failed to fetch associated forms");
      const associationsData = await associationsResponse.json();
      const formIds = new Set(associationsData.formIds);
      setSelectedFormIds(formIds);

      setOriginalFormIds(new Set(formIds));
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load forms");
    } finally {
      setIsLoading(false);
    }
  };

  // Save form associations
  const handleSave = async () => {
    if (!appointmentType) return;

    setIsSaving(true);
    try {
      const response = await adminClient.integration.acuity["appointment-types"][":id"].forms.$put({
        param: { id: appointmentType.id.toString() },
        json: { formIds: Array.from(selectedFormIds) },
      });

      if (!response.ok) {
        throw new Error("Failed to update form associations");
      }

      const result = await response.json();
      if ("success" in result && result.success) {
        toast.success("Form associations updated successfully");
        onUpdate(); // Refresh the appointment types list
        onClose();
      } else {
        throw new Error((result as any).error || "Failed to update");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to update form associations");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle form selection
  const toggleForm = (formId: number) => {
    setSelectedFormIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(formId)) {
        newSet.delete(formId);
      } else {
        newSet.add(formId);
      }
      return newSet;
    });
  };

  // Categorize forms into linked and available
  const categorizedForms = {
    linked: availableForms.filter((form) => originalFormIds.has(form.id)),
    available: availableForms.filter((form) => !originalFormIds.has(form.id)),
  };

  // Filter forms based on search
  const filterForms = (forms: FormOption[]) => {
    if (!searchQuery) return forms;
    const query = searchQuery.toLowerCase();
    return forms.filter(
      (form) =>
        form.name.toLowerCase().includes(query) ||
        (form.description && form.description.toLowerCase().includes(query))
    );
  };

  const filteredLinkedForms = filterForms(categorizedForms.linked);
  const filteredAvailableForms = filterForms(categorizedForms.available);

  // Check if there are unsaved changes
  const hasChanges =
    selectedFormIds.size !== originalFormIds.size ||
    Array.from(selectedFormIds).some((id) => !originalFormIds.has(id));

  // Load data when modal opens
  useEffect(() => {
    if (open && appointmentType) {
      fetchData();
    } else if (!open) {
      // Reset state when modal closes
      setAvailableForms([]);
      setSelectedFormIds(new Set());
      setOriginalFormIds(new Set());
      setSearchQuery("");
    }
  }, [open, appointmentType]);

  if (!appointmentType) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Forms</DialogTitle>
          <DialogDescription>
            Select forms for <span className="font-medium">{appointmentType.name}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading forms...</p>
          </div>
        ) : (
          <>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Forms List */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-6">
                {/* Currently Linked Forms Section */}
                {categorizedForms.linked.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2">
                      <h3 className="text-sm font-semibold text-foreground">Currently Linked</h3>
                      <Badge variant="default" className="text-xs">
                        {filteredLinkedForms.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {filteredLinkedForms.length === 0 && searchQuery ? (
                        <p className="text-sm text-muted-foreground pl-2">
                          No linked forms match your search
                        </p>
                      ) : (
                        filteredLinkedForms.map((form) => (
                          <div
                            key={form.id}
                            className="flex items-start space-x-3 p-3 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
                          >
                            <Checkbox
                              id={`form-${form.id}`}
                              checked={selectedFormIds.has(form.id)}
                              onCheckedChange={() => toggleForm(form.id)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`form-${form.id}`}
                              className="flex-1 cursor-pointer space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{form.name}</span>
                                {form.hidden && (
                                  <Badge variant="secondary" className="text-xs">
                                    Hidden
                                  </Badge>
                                )}
                                {form.fieldCount !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    <FileText className="w-3 h-3 mr-1" />
                                    {form.fieldCount} fields
                                  </Badge>
                                )}
                              </div>
                              {form.description && (
                                <p className="text-sm text-muted-foreground">{form.description}</p>
                              )}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Visual Separator */}
                {categorizedForms.linked.length > 0 && categorizedForms.available.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                  </div>
                )}

                {/* Available Forms Section */}
                {categorizedForms.available.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2">
                      <h3 className="text-sm font-semibold text-foreground">Available to Add</h3>
                      <Badge variant="secondary" className="text-xs">
                        {filteredAvailableForms.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {filteredAvailableForms.length === 0 && searchQuery ? (
                        <p className="text-sm text-muted-foreground pl-2">
                          No available forms match your search
                        </p>
                      ) : (
                        filteredAvailableForms.map((form) => (
                          <div
                            key={form.id}
                            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={`form-${form.id}`}
                              checked={selectedFormIds.has(form.id)}
                              onCheckedChange={() => toggleForm(form.id)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`form-${form.id}`}
                              className="flex-1 cursor-pointer space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{form.name}</span>
                                {form.hidden && (
                                  <Badge variant="secondary" className="text-xs">
                                    Hidden
                                  </Badge>
                                )}
                                {form.fieldCount !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    <FileText className="w-3 h-3 mr-1" />
                                    {form.fieldCount} fields
                                  </Badge>
                                )}
                              </div>
                              {form.description && (
                                <p className="text-sm text-muted-foreground">{form.description}</p>
                              )}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* No Forms Available */}
                {categorizedForms.linked.length === 0 &&
                  categorizedForms.available.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No forms available</div>
                  )}

                {/* No Search Results */}
                {searchQuery &&
                  filteredLinkedForms.length === 0 &&
                  filteredAvailableForms.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No forms match your search
                    </div>
                  )}
              </div>
            </ScrollArea>

            {/* Selection Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {selectedFormIds.size} of {availableForms.length} forms selected
              </span>
              {hasChanges && (
                <Badge variant="secondary">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Unsaved changes
                </Badge>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !hasChanges}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
