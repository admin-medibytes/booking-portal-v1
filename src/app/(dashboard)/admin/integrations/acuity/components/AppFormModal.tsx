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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Settings2,
  Eye,
  EyeOff,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Type,
  Shield,
  ChevronDown,
  Palette,
  Mail,
  Phone,
  Hash,
  Calendar,
  Clock,
  Link,
  AlignLeft,
  AlignJustify,
  HelpCircle,
  MoveUp,
  MoveDown,
  Regex,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { adminClient } from "@/lib/hono-client";
import { cn } from "@/lib/utils";
import type { ExamineeFieldType } from "@/server/db/schema/appForms";
import { UserCheck } from "lucide-react";

interface AppFormModalProps {
  open: boolean;
  onClose: () => void;
  form: {
    id: number;
    name: string;
    description: string;
    hasAppForm?: boolean;
    appFormId?: string;
    fieldCount?: number;
  } | null;
  onSuccess?: () => void;
}

type CustomFieldType = "text" | "email" | "phone" | "number" | "date" | "dob" | "time" | "url";
type ModalState = "loading" | "form" | "saving" | "success" | "error";

interface ValidationRules {
  type?: "email" | "phone" | "date" | "number" | "string";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  message?: string;
}

interface AppFormField {
  id: string;
  appFormId: string;
  acuityFieldId: number;
  acuityFieldName: string;
  customLabel?: string | null;
  placeholderText?: string | null;
  helpText?: string | null;
  tooltipText?: string | null;
  customFieldType?: CustomFieldType | null;
  isRequired: boolean;
  validationRules: ValidationRules;
  isHidden: boolean;
  staticValue?: string | null;
  displayOrder: number;
  displayWidth: "full" | "half" | "third";
  examineeFieldMapping?: ExamineeFieldType | null;
  createdAt?: string;
  updatedAt?: string;
  // We'll fetch this separately if needed
  acuityField?: {
    id: number;
    name: string;
    type: string;
    required: boolean;
    options?: string[] | null;
  };
}

const fieldTypeIcons: Record<CustomFieldType, React.ReactNode> = {
  text: <Type className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  phone: <Phone className="w-3 h-3" />,
  number: <Hash className="w-3 h-3" />,
  date: <Calendar className="w-3 h-3" />,
  dob: <Calendar className="w-3 h-3" />,
  time: <Clock className="w-3 h-3" />,
  url: <Link className="w-3 h-3" />,
};

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: "Text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  dob: "Date of Birth",
  time: "Time",
  url: "URL",
};

const examineeFieldLabels: Record<ExamineeFieldType, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  dateOfBirth: "Date of Birth",
  email: "Email",
  phoneNumber: "Phone Number",
  address: "Address",
  authorizedContact: "Authorized Contact",
  condition: "Medical Condition",
  caseType: "Case Type",
};

export function AppFormModal({ open, onClose, form, onSuccess }: AppFormModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [appFormName, setAppFormName] = useState("");
  const [appFormDescription, setAppFormDescription] = useState("");
  const [appFormData, setAppFormData] = useState<any>(null);
  const [fields, setFields] = useState<AppFormField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedFields, setExpandedFields] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch existing app form data if it exists
  useEffect(() => {
    if (open && form?.hasAppForm && form.appFormId) {
      fetchAppForm(form.appFormId);
    } else if (open && form) {
      // Set initial values for new app form
      setAppFormName(form.name);
      setAppFormDescription(form.description || "");
      setFields([]);
      setAppFormData(null);
      setState("form");
    }
  }, [open, form]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setState("loading");
      setError(null);
      setExpandedFields([]);
    }
  }, [open]);

  const fetchAppForm = async (appFormId: string) => {
    setState("loading");
    setError(null);

    try {
      const response = await adminClient["app-forms"][":id"].$get({
        param: { id: appFormId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch app form");
      }

      const data = await response.json();
      if (data.success && data.data) {
        const appForm = data.data;

        // Fetch the Acuity form fields to get field types
        try {
          const acuityFormResponse = await adminClient.integration.acuity.forms[":id"].$get({
            param: { id: appForm.acuityFormId.toString() },
          });

          if (acuityFormResponse.ok) {
            const acuityFormData = await acuityFormResponse.json();
            if (acuityFormData.success && acuityFormData.data?.fields) {
              // Map Acuity field data to app form fields
              const fieldsWithAcuityData = appForm.fields.map((field: any) => {
                const acuityField = acuityFormData.data.fields.find(
                  (af: any) => af.id === field.acuityFieldId
                );
                return {
                  ...field,
                  staticValue: field.staticValue ?? "", // Ensure staticValue is always defined
                  acuityFieldName:
                    field.acuityFieldName || acuityField?.name || `Field ${field.acuityFieldId}`,
                  acuityField: acuityField || {
                    id: field.acuityFieldId,
                    name: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                    type: "textbox", // default if not found
                    required: false,
                    options: null,
                  },
                } as AppFormField;
              });
              // Sort fields by display order
              fieldsWithAcuityData.sort(
                (a: AppFormField, b: AppFormField) => a.displayOrder - b.displayOrder
              );
              setFields(fieldsWithAcuityData);
            } else {
              // If we can't get Acuity fields, ensure all required fields are present
              const fieldsWithDefaults = appForm.fields.map(
                (field: any) =>
                  ({
                    ...field,
                    staticValue: field.staticValue ?? "", // Ensure staticValue is always defined
                    acuityFieldName: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                    acuityField: {
                      id: field.acuityFieldId,
                      name: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                      type: "textbox",
                      required: false,
                      options: null,
                    },
                  }) as AppFormField
              );
              // Sort fields by display order
              fieldsWithDefaults.sort(
                (a: AppFormField, b: AppFormField) => a.displayOrder - b.displayOrder
              );
              setFields(fieldsWithDefaults);
            }
          } else {
            // If Acuity form fetch fails, ensure all required fields are present
            const fieldsWithDefaults = appForm.fields.map(
              (field: any) =>
                ({
                  ...field,
                  acuityFieldName: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                  acuityField: {
                    id: field.acuityFieldId,
                    name: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                    type: "textbox",
                    required: false,
                    options: null,
                  },
                }) as AppFormField
            );
            // Sort fields by display order
            fieldsWithDefaults.sort(
              (a: AppFormField, b: AppFormField) => a.displayOrder - b.displayOrder
            );
            setFields(fieldsWithDefaults);
          }
        } catch {
          // If fetching Acuity fields fails, ensure all required fields are present
          const fieldsWithDefaults = appForm.fields.map(
            (field: any) =>
              ({
                ...field,
                acuityFieldName: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                acuityField: {
                  id: field.acuityFieldId,
                  name: field.acuityFieldName || `Field ${field.acuityFieldId}`,
                  type: "textbox",
                  required: false,
                  options: null,
                },
              }) as AppFormField
          );
          // Sort fields by display order
          fieldsWithDefaults.sort(
            (a: AppFormField, b: AppFormField) => a.displayOrder - b.displayOrder
          );
          setFields(fieldsWithDefaults);
        }

        setAppFormData(appForm);
        setAppFormName(appForm.name);
        setAppFormDescription(appForm.description || "");
        setState("form");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app form");
      setState("error");
    }
  };

  const handleCreate = async () => {
    if (!form) return;

    setState("saving");
    setError(null);

    try {
      const response = await adminClient["app-forms"].$post({
        json: {
          acuityFormId: form.id,
          name: appFormName,
          description: appFormDescription || undefined,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error((error as any).error || "Failed to create app form");
      }

      const data = await response.json();
      if (data.success) {
        setState("success");
        toast.success("App form created successfully");
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create app form");
      setState("error");
    }
  };

  const handleUpdate = async () => {
    if (!appFormData) return;

    setState("saving");
    setError(null);

    try {
      // Update general info
      const response = await adminClient["app-forms"][":id"].$put({
        param: { id: appFormData.id },
        json: {
          name: appFormName,
          description: appFormDescription || undefined,
          isActive: appFormData.isActive,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to update app form");
      }

      // Update fields if any changes
      if (fields.length > 0) {
        const fieldsResponse = await adminClient["app-forms"][":id"].fields.$put({
          param: { id: appFormData.id },
          json: { fields },
        });

        if (!fieldsResponse.ok) {
          throw new Error("Failed to update fields");
        }
      }

      setState("success");
      toast.success("App form updated successfully");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update app form");
      setState("error");
    }
  };

  const handleFieldUpdate = (fieldId: string, updates: Partial<AppFormField>) => {
    setFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, ...updates } : field))
    );
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    // Swap the fields
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];

    // Update display orders
    const updatedFields = newFields.map((field, idx) => ({
      ...field,
      displayOrder: idx + 1,
    }));

    setFields(updatedFields);
  };

  const handleValidationRuleUpdate = (
    fieldId: string,
    ruleKey: keyof ValidationRules,
    value: any
  ) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId) {
          const updatedRules = { ...field.validationRules };

          if (value === null || value === undefined || value === "") {
            delete updatedRules[ruleKey];
          } else {
            updatedRules[ruleKey] = value;
          }

          return { ...field, validationRules: updatedRules };
        }
        return field;
      })
    );
  };

  const handleDelete = async () => {
    if (!appFormData) return;

    setShowDeleteDialog(false);
    setState("saving");
    setError(null);

    try {
      const response = await adminClient["app-forms"][":id"].$delete({
        param: { id: appFormData.id },
      });

      if (!response.ok) {
        throw new Error("Failed to delete app form");
      }

      setState("success");
      toast.success("App form deleted successfully");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to delete app form");
      setState("error");
    }
  };

  const getModalTitle = () => {
    if (state === "loading") return "Loading...";
    if (state === "saving")
      return form?.hasAppForm ? "Updating App Form..." : "Creating App Form...";
    if (state === "success") return "Success!";
    if (state === "error") return "Error";
    return form?.hasAppForm ? "Edit App Form" : "Create App Form";
  };

  const getModalDescription = () => {
    if (state === "loading") return "Loading form configuration...";
    if (state === "saving") return "Please wait while we save your changes...";
    if (state === "success")
      return form?.hasAppForm ? "App form updated successfully!" : "App form created successfully!";
    if (state === "error") return "An error occurred while processing your request";
    return form?.hasAppForm
      ? "Customize how this form appears and behaves in your application"
      : "Create a customized version of this Acuity form for your application";
  };

  const toggleFieldExpansion = (fieldId: string) => {
    setExpandedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="md:max-w-5xl px-0">
          <DialogHeader className="px-6">
            <DialogTitle>{getModalTitle()}</DialogTitle>
            <DialogDescription>{getModalDescription()}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {state === "loading" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading form configuration...</p>
              </div>
            )}

            {state === "form" && (
              <ScrollArea className="h-[65dvh] border-y">
                <div className="px-6 py-4 space-y-6">
                  {/* General Settings Section */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Form Name</Label>
                      <Input
                        id="name"
                        value={appFormName}
                        onChange={(e) => setAppFormName(e.target.value)}
                        placeholder="Enter a name for your customized form"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={appFormDescription}
                        onChange={(e) => setAppFormDescription(e.target.value)}
                        placeholder="Optional description for this form"
                        rows={3}
                      />
                    </div>

                    {!appFormData && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Once created, you'll be able to configure individual field settings and
                          customize the form's appearance.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Separator between sections */}
                  {appFormData && fields.length > 0 && <Separator />}

                  {/* Field Configuration Section */}
                  {appFormData && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium">Field Configuration</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Configure how each field appears and behaves
                          </p>
                        </div>
                        {fields.length > 0 && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedFields(fields.map((f) => f.id))}
                            >
                              Expand All
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setExpandedFields([])}>
                              Collapse All
                            </Button>
                          </div>
                        )}
                      </div>

                      {fields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Settings2 className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-sm text-muted-foreground text-center">
                            No fields configured yet. Fields will be loaded from the Acuity form.
                          </p>
                        </div>
                      ) : (
                        <TooltipProvider>
                          <div className="space-y-3">
                            {fields.map((field, index) => {
                              const isExpanded = expandedFields.includes(field.id);
                              const hasCustomizations = !!(
                                field.customLabel ||
                                field.placeholderText ||
                                field.helpText ||
                                field.tooltipText ||
                                field.customFieldType ||
                                field.isHidden ||
                                field.staticValue ||
                                field.displayWidth !== "full" ||
                                field.examineeFieldMapping
                              );

                              const hasValidationRules = !!(
                                field.validationRules &&
                                Object.keys(field.validationRules).length > 0
                              );

                              return (
                                <Card
                                  key={field.id}
                                  className={cn(
                                    "overflow-hidden transition-all py-0",
                                    field.isHidden && "border-amber-200 bg-amber-50/30"
                                  )}
                                >
                                  {/* Field Header - Always Visible */}
                                  <div
                                    className={cn(
                                      "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                                      isExpanded && "border-b"
                                    )}
                                    onClick={() => toggleFieldExpansion(field.id)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <ChevronDown
                                          className={cn(
                                            "w-4 h-4 text-muted-foreground transition-transform",
                                            isExpanded && "rotate-180"
                                          )}
                                        />
                                        <Badge variant="outline" className="text-xs font-mono">
                                          #{index + 1}
                                        </Badge>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                              {field.customLabel ||
                                                field.acuityFieldName ||
                                                `Field ${field.acuityFieldId}`}
                                            </span>
                                            {field.customLabel && (
                                              <span className="text-xs text-muted-foreground">
                                                (was:{" "}
                                                {field.acuityFieldName || field.acuityField?.name})
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">
                                              {field.acuityField?.type}
                                            </Badge>
                                            {field.isRequired && (
                                              <Badge variant="secondary" className="text-xs">
                                                Required
                                              </Badge>
                                            )}
                                            {field.isHidden && (
                                              <Badge variant="warning" className="text-xs">
                                                Hidden
                                              </Badge>
                                            )}
                                            {field.customFieldType &&
                                              field.acuityField?.type === "textbox" && (
                                                <Badge variant="default" className="text-xs">
                                                  {fieldTypeLabels[field.customFieldType]}
                                                </Badge>
                                              )}
                                            {hasCustomizations && (
                                              <Badge variant="success" className="text-xs">
                                                Customized
                                              </Badge>
                                            )}
                                            {hasValidationRules && (
                                              <Badge variant="default" className="text-xs">
                                                <Shield className="w-3 h-3 mr-1" />
                                                Validated
                                              </Badge>
                                            )}
                                            {field.examineeFieldMapping && (
                                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                                                <UserCheck className="w-3 h-3 mr-1" />
                                                {examineeFieldLabels[field.examineeFieldMapping]}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Field Actions */}
                                      <div className="flex items-center gap-1">
                                        {/* Reorder Buttons */}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveField(index, "up");
                                              }}
                                              disabled={index === 0}
                                            >
                                              <MoveUp className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Move Up</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveField(index, "down");
                                              }}
                                              disabled={index === fields.length - 1}
                                            >
                                              <MoveDown className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Move Down</TooltipContent>
                                        </Tooltip>

                                        {/* Visibility Toggle */}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const updates: any = { isHidden: !field.isHidden };
                                                // Initialize staticValue when hiding a field if it doesn't exist
                                                if (
                                                  !field.isHidden &&
                                                  (field.staticValue === undefined ||
                                                    field.staticValue === null)
                                                ) {
                                                  updates.staticValue = "";
                                                }
                                                handleFieldUpdate(field.id, updates);
                                              }}
                                            >
                                              {field.isHidden ? (
                                                <EyeOff className="w-4 h-4 text-amber-600" />
                                              ) : (
                                                <Eye className="w-4 h-4" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {field.isHidden
                                              ? "Hidden from users"
                                              : "Visible to users"}
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expandable Content */}
                                  {isExpanded && (
                                    <div className="p-4 space-y-4 bg-muted/20">
                                      {/* Display & Layout Section */}
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                          <Palette className="w-4 h-4 text-muted-foreground" />
                                          Display & Layout
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pl-6">
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal">
                                              Custom Label
                                            </Label>
                                            <Input
                                              placeholder={
                                                field.acuityFieldName || field.acuityField?.name
                                              }
                                              value={field.customLabel || ""}
                                              onChange={(e) =>
                                                handleFieldUpdate(field.id, {
                                                  customLabel: e.target.value || null,
                                                })
                                              }
                                              className="h-9"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal">
                                              Placeholder Text
                                            </Label>
                                            <Input
                                              placeholder="Enter placeholder..."
                                              value={field.placeholderText || ""}
                                              onChange={(e) =>
                                                handleFieldUpdate(field.id, {
                                                  placeholderText: e.target.value || null,
                                                })
                                              }
                                              className="h-9"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal flex items-center gap-1">
                                              <UserCheck className="w-3 h-3" />
                                              Map to Examinee Field
                                            </Label>
                                            <Select
                                              value={field.examineeFieldMapping || "none"}
                                              onValueChange={(value) =>
                                                handleFieldUpdate(field.id, {
                                                  examineeFieldMapping: value === "none" ? null : (value as ExamineeFieldType),
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Not mapped" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">
                                                  <span className="text-muted-foreground">Not mapped</span>
                                                </SelectItem>
                                                <Separator className="my-1" />
                                                {(Object.keys(examineeFieldLabels) as ExamineeFieldType[]).map((fieldType) => (
                                                  <SelectItem key={fieldType} value={fieldType}>
                                                    {examineeFieldLabels[fieldType]}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            {field.examineeFieldMapping && (
                                              <p className="text-xs text-muted-foreground">
                                                This field will be mapped to the examinee's {examineeFieldLabels[field.examineeFieldMapping].toLowerCase()}.
                                              </p>
                                            )}
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal">Width</Label>
                                            <Select
                                              value={field.displayWidth}
                                              onValueChange={(value: "full" | "half" | "third") =>
                                                handleFieldUpdate(field.id, { displayWidth: value })
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="full">
                                                  <div className="flex items-center gap-2">
                                                    <AlignJustify className="w-3 h-3" />
                                                    Full Width
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="half">
                                                  <div className="flex items-center gap-2">
                                                    <AlignLeft className="w-3 h-3" />
                                                    Half Width
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="third">
                                                  <div className="flex items-center gap-2">
                                                    <AlignLeft className="w-3 h-3" />
                                                    Third Width
                                                  </div>
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          {field.acuityField?.type === "textbox" && (
                                            <div className="space-y-2">
                                              <Label className="text-xs font-normal">
                                                Input Type
                                              </Label>
                                              <Select
                                                value={field.customFieldType || "text"}
                                                onValueChange={(value: CustomFieldType) =>
                                                  handleFieldUpdate(field.id, {
                                                    customFieldType: value,
                                                  })
                                                }
                                              >
                                                <SelectTrigger className="h-9">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {Object.entries(fieldTypeLabels).map(
                                                    ([value, label]) => (
                                                      <SelectItem key={value} value={value}>
                                                        <div className="flex items-center gap-2">
                                                          {fieldTypeIcons[value as CustomFieldType]}
                                                          {label}
                                                        </div>
                                                      </SelectItem>
                                                    )
                                                  )}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <Separator />

                                      {/* Help & Guidance Section */}
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                          Help & Guidance
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pl-6">
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal">Help Text</Label>
                                            <Input
                                              placeholder="Instructions shown below field"
                                              value={field.helpText || ""}
                                              onChange={(e) =>
                                                handleFieldUpdate(field.id, {
                                                  helpText: e.target.value || null,
                                                })
                                              }
                                              className="h-9"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-normal">Tooltip</Label>
                                            <Input
                                              placeholder="Hover hint text"
                                              value={field.tooltipText || ""}
                                              onChange={(e) =>
                                                handleFieldUpdate(field.id, {
                                                  tooltipText: e.target.value || null,
                                                })
                                              }
                                              className="h-9"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <Separator />

                                      {/* Validation & Behavior Section */}
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                          <Shield className="w-4 h-4 text-muted-foreground" />
                                          Validation & Behavior
                                        </div>
                                        <div className="pl-6 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <Switch
                                                id={`required-${field.id}`}
                                                checked={field.isRequired}
                                                onCheckedChange={(checked) =>
                                                  handleFieldUpdate(field.id, {
                                                    isRequired: checked,
                                                  })
                                                }
                                              />
                                              <Label
                                                htmlFor={`required-${field.id}`}
                                                className="text-sm cursor-pointer font-normal"
                                              >
                                                Make this field required
                                              </Label>
                                            </div>
                                          </div>

                                          {field.isHidden &&
                                            (() => {
                                              const currentField =
                                                fields.find((f) => f.id === field.id) || field;
                                              return (
                                                <div
                                                  className="border border-amber-200 bg-amber-50 rounded-lg p-4"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="flex gap-2">
                                                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                      <p className="text-xs text-amber-900">
                                                        This field is hidden from users. You can set a
                                                        static value that will be submitted
                                                        automatically.
                                                      </p>
                                                      <div
                                                        className="mt-3"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <Label className="text-xs font-normal text-amber-900">
                                                          Static Value
                                                        </Label>
                                                        <Input
                                                          type="text"
                                                          placeholder="Value to submit when hidden"
                                                          value={currentField.staticValue || ""}
                                                          onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleFieldUpdate(currentField.id, {
                                                              staticValue: e.target.value,
                                                            });
                                                          }}
                                                          onClick={(e) => e.stopPropagation()}
                                                          onFocus={(e) => e.stopPropagation()}
                                                          onKeyDown={(e) => e.stopPropagation()}
                                                          onMouseDown={(e) => e.stopPropagation()}
                                                          className="h-9 mt-1 w-full"
                                                        />
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })()}

                                          {/* Advanced Validation Rules */}
                                          {!field.isHidden && (
                                            <div className="space-y-3 border rounded-lg p-3 bg-background">
                                              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <Regex className="w-3 h-3" />
                                                Validation Rules
                                              </div>

                                              <div className="grid grid-cols-2 gap-3">
                                                {/* Validation Type */}
                                                {field.acuityField?.type === "textbox" && (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs font-normal">
                                                      Validation Type
                                                    </Label>
                                                    <Select
                                                      value={field.validationRules?.type || "none"}
                                                      onValueChange={(value) =>
                                                        handleValidationRuleUpdate(
                                                          field.id,
                                                          "type",
                                                          value === "none" ? null : value
                                                        )
                                                      }
                                                    >
                                                      <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="None" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        <SelectItem value="string">
                                                          String
                                                        </SelectItem>
                                                        <SelectItem value="email">Email</SelectItem>
                                                        <SelectItem value="phone">Phone</SelectItem>
                                                        <SelectItem value="number">
                                                          Number
                                                        </SelectItem>
                                                        <SelectItem value="date">Date</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                )}

                                                {/* Pattern */}
                                                {field.acuityField?.type === "textbox" && (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs font-normal">
                                                      Regex Pattern
                                                    </Label>
                                                    <Input
                                                      placeholder="e.g., ^[A-Z]{2}[0-9]{4}$"
                                                      value={field.validationRules?.pattern || ""}
                                                      onChange={(e) =>
                                                        handleValidationRuleUpdate(
                                                          field.id,
                                                          "pattern",
                                                          e.target.value || null
                                                        )
                                                      }
                                                      className="h-8 text-xs"
                                                    />
                                                  </div>
                                                )}

                                                {/* Min/Max Length for strings */}
                                                {(field.validationRules?.type === "string" ||
                                                  field.validationRules?.type === "email" ||
                                                  (!field.validationRules?.type &&
                                                    field.acuityField?.type === "textbox")) && (
                                                  <>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Min Length
                                                      </Label>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        placeholder="e.g., 3"
                                                        value={
                                                          field.validationRules?.minLength || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "minLength",
                                                            e.target.value
                                                              ? parseInt(e.target.value)
                                                              : null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Max Length
                                                      </Label>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        placeholder="e.g., 100"
                                                        value={
                                                          field.validationRules?.maxLength || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "maxLength",
                                                            e.target.value
                                                              ? parseInt(e.target.value)
                                                              : null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                  </>
                                                )}

                                                {/* Min/Max for numbers */}
                                                {field.validationRules?.type === "number" && (
                                                  <>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Min Value
                                                      </Label>
                                                      <Input
                                                        type="number"
                                                        placeholder="e.g., 0"
                                                        value={field.validationRules?.min || ""}
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "min",
                                                            e.target.value
                                                              ? parseFloat(e.target.value)
                                                              : null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Max Value
                                                      </Label>
                                                      <Input
                                                        type="number"
                                                        placeholder="e.g., 100"
                                                        value={field.validationRules?.max || ""}
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "max",
                                                            e.target.value
                                                              ? parseFloat(e.target.value)
                                                              : null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                  </>
                                                )}

                                                {/* Min/Max for dates */}
                                                {field.validationRules?.type === "date" && (
                                                  <>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Min Date
                                                      </Label>
                                                      <Input
                                                        type="date"
                                                        value={field.validationRules?.min || ""}
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "min",
                                                            e.target.value || null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                    <div className="space-y-1">
                                                      <Label className="text-xs font-normal">
                                                        Max Date
                                                      </Label>
                                                      <Input
                                                        type="date"
                                                        value={field.validationRules?.max || ""}
                                                        onChange={(e) =>
                                                          handleValidationRuleUpdate(
                                                            field.id,
                                                            "max",
                                                            e.target.value || null
                                                          )
                                                        }
                                                        className="h-8 text-xs"
                                                      />
                                                    </div>
                                                  </>
                                                )}

                                                {/* Custom Error Message */}
                                                <div className="col-span-2 space-y-1">
                                                  <Label className="text-xs font-normal">
                                                    Custom Error Message
                                                  </Label>
                                                  <Input
                                                    placeholder="e.g., Please enter a valid email address"
                                                    value={field.validationRules?.message || ""}
                                                    onChange={(e) =>
                                                      handleValidationRuleUpdate(
                                                        field.id,
                                                        "message",
                                                        e.target.value || null
                                                      )
                                                    }
                                                    className="h-8 text-xs"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {state === "saving" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Saving your changes...</p>
              </div>
            )}

            {state === "success" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <p className="text-lg font-medium">
                  {form?.hasAppForm ? "App form updated!" : "App form created!"}
                </p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-lg font-medium">Operation failed</p>
                <p className="text-sm text-muted-foreground text-center px-6">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6">
            {state === "form" && (
              <>
                {form?.hasAppForm && appFormData && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="mr-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={form?.hasAppForm ? handleUpdate : handleCreate}
                  disabled={!appFormName}
                >
                  {form?.hasAppForm ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create App Form
                    </>
                  )}
                </Button>
              </>
            )}

            {state === "error" && (
              <>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setState("form");
                    setError(null);
                  }}
                >
                  Try Again
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete App Form</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm">Are you sure you want to delete this app form?</p>
                <div className="rounded-md border bg-muted/50 p-3">
                  <p
                    className="text-sm font-medium line-clamp-2"
                    title={appFormName}
                    style={{ wordBreak: "break-word" }}
                  >
                    {appFormName}
                  </p>
                </div>
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive mb-1 break-words">
                    This action cannot be undone.
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    All field configurations and customizations will be permanently removed.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete App Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
