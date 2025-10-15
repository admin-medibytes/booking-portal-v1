"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarDays, HelpCircle, Loader2 } from "lucide-react";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface ValidationRules {
  type?: "email" | "phone" | "date" | "number" | "string";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  message?: string;
}

interface AcuityField {
  id: number;
  name: string;
  type: "textbox" | "textarea" | "dropdown" | "checkbox" | "checkboxlist" | "yesno" | "file";
  options?: string[];
  required?: boolean;
}

interface AppFormField {
  id: string;
  appFormId: string;
  acuityFieldId: number;
  acuityField?: AcuityField;
  customLabel?: string | null;
  placeholderText?: string | null;
  helpText?: string | null;
  tooltipText?: string | null;
  customFieldType?: "text" | "email" | "phone" | "number" | "date" | "dob" | "time" | "url" | null;
  isRequired: boolean;
  validationRules: ValidationRules;
  isHidden: boolean;
  staticValue?: string | null;
  displayOrder: number;
  displayWidth: "full" | "half" | "third";
}

interface AppForm {
  id: string;
  name: string;
  fields: AppFormField[];
}

interface AppFormRendererProps {
  form: AppForm;
  onSubmit: (
    data: Record<string, string | number | boolean | string[] | null | undefined>
  ) => void | Promise<void>;
  onValidationChange?: (isValid: boolean) => void;
  defaultValues?: Record<string, string | number | boolean | string[] | null | undefined>;
  isSubmitting?: boolean;
  submitLabel?: string;
  className?: string;
  hideSubmitButton?: boolean;
}

export interface AppFormRendererRef {
  submit: () => void;
}

// Build arktype schema dynamically based on form fields
function buildArktypeSchema(fields: AppFormField[]) {
  const schemaObj: Record<string, unknown> = {};

  fields.forEach((field) => {
    const fieldName = `field_${field.acuityFieldId}`;
    let fieldType = "string";

    // Handle different validation types
    if (field.validationRules.type === "email" || field.customFieldType === "email") {
      fieldType = "string.email";
    } else if (field.validationRules.type === "number" || field.customFieldType === "number") {
      fieldType = "number";
    } else if (field.validationRules.type === "date" || field.customFieldType === "date") {
      fieldType = "string"; // Date will be a string in ISO format
    } else if (field.acuityField?.type === "checkbox") {
      fieldType = "boolean";
    } else if (field.acuityField?.type === "checkboxlist") {
      fieldType = "string[]";
    } else if (field.acuityField?.type === "yesno") {
      // For yes/no fields, allow empty string initially even if required
      // The field validator will show error if required and empty
      fieldType = "'yes'|'no'|''";
    } else if (field.validationRules.minLength) {
      fieldType = `string>${field.validationRules.minLength - 1}`;
    } else if (field.isRequired) {
      fieldType = "string>0";
    }

    // Make field optional if not required
    if (!field.isRequired && !field.isHidden) {
      // For optional fields, use the ? suffix to make the key optional
      // and allow empty string, null, undefined, or the field type
      if (fieldType === "boolean") {
        schemaObj[`${fieldName}?`] = "boolean";
      } else if (fieldType === "string[]") {
        schemaObj[`${fieldName}?`] = "string[]";
      } else if (fieldType === "'yes'|'no'|''") {
        // Yes/no fields already allow empty string
        schemaObj[`${fieldName}?`] = "'yes'|'no'|''";
      } else if (fieldType === "string.email") {
        // For optional email fields, allow valid email, empty string, null, or undefined
        schemaObj[`${fieldName}?`] = "string.email|''";
      } else if (fieldType === "number") {
        // For optional number fields
        schemaObj[`${fieldName}?`] = "number|''";
      } else if (fieldType.startsWith("string>")) {
        // For strings with min length, when optional allow empty string, null or undefined
        schemaObj[`${fieldName}?`] = `${fieldType}|''`;
      } else {
        // For other string types, allow empty string, null or undefined
        schemaObj[`${fieldName}?`] = "string";
      }
    } else if (field.isHidden && field.staticValue) {
      // Hidden fields with static values are always included
      schemaObj[fieldName] = `'${field.staticValue}'`;
    } else {
      schemaObj[fieldName] = fieldType;
    }
  });

  return type(schemaObj);
}

export const AppFormRenderer = forwardRef<AppFormRendererRef, AppFormRendererProps>(
  (
    {
      form,
      onSubmit,
      onValidationChange,
      defaultValues: providedDefaultValues,
      isSubmitting = false,
      submitLabel = "Submit",
      className,
      hideSubmitButton = false,
    },
    ref
  ) => {

    
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Sort fields by displayOrder
    const sortedFields = [...form.fields].sort((a, b) => a.displayOrder - b.displayOrder);

    // Build schema
    const formSchema = buildArktypeSchema(sortedFields);

    // Initialize form with default values - merge provided defaults with hidden field values
    const defaultValues: Record<string, string | number | boolean | string[] | null | undefined> = {
      ...providedDefaultValues,
    };
    sortedFields.forEach((field) => {
      const fieldKey = `field_${field.acuityFieldId}`;
      // Set hidden field static values
      if (field.isHidden && field.staticValue) {
        defaultValues[fieldKey] = field.staticValue;
      }
      // If no provided default value for this field, initialize it with appropriate type
      if (!(fieldKey in defaultValues)) {
        if (field.acuityField?.type === "checkbox") {
          defaultValues[fieldKey] = false;
        } else if (field.acuityField?.type === "checkboxlist") {
          defaultValues[fieldKey] = [];
        } else if (field.acuityField?.type === "yesno") {
          defaultValues[fieldKey] = "";
        } else {
          defaultValues[fieldKey] = "";
        }
      }
    });

    const formInstance = useForm({
      defaultValues,
      onSubmit: async ({ value }) => {
        setSubmitError(null);
        try {
          await onSubmit(value);
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : "Failed to submit form");
        }
      },
    });

    // Expose submit method via ref
    useImperativeHandle(ref, () => ({
      submit: () => {
        formInstance.handleSubmit();
      },
    }));

    // Track form validation state using subscription
    useEffect(() => {
      if (!onValidationChange) return;

      const checkValidation = () => {
        const values = formInstance.state.values;
        console.log("Raw form values:", JSON.stringify(values, null, 2));
        const result = formSchema(values);
        const isValid = !(result instanceof type.errors);
        console.log("AppFormRenderer validation check:", values, "isValid:", isValid);
        if (result instanceof type.errors) {
          console.log("AppFormRenderer validation errors:", result.summary);
        }
        onValidationChange(isValid);
      };

      // Check validation immediately
      checkValidation();

      // Subscribe to form state changes
      const unsubscribe = formInstance.store.subscribe(() => {
        checkValidation();
      });

      return () => unsubscribe();
    }, [formInstance.store, formInstance.state.values, onValidationChange, formSchema]);

    // Group fields into rows based on displayWidth
    const fieldRows: AppFormField[][] = [];
    let currentRow: AppFormField[] = [];
    let currentRowWidth = 0; // Track cumulative width: third=4, half=6, full=12 (out of 12 units)

    sortedFields.forEach((field) => {
      if (!field.isHidden) {
        const fieldWidth =
          field.displayWidth === "full" ? 12 : field.displayWidth === "half" ? 6 : 4;

        // Check if adding this field would exceed row capacity (12 units)
        if (field.displayWidth === "full" || currentRowWidth + fieldWidth > 12) {
          // Push current row if it has content
          if (currentRow.length > 0) {
            fieldRows.push(currentRow);
          }
          // Start new row with this field
          currentRow = [field];
          currentRowWidth = fieldWidth;

          // If it's a full-width field, push it immediately and reset
          if (field.displayWidth === "full") {
            fieldRows.push(currentRow);
            currentRow = [];
            currentRowWidth = 0;
          }
        } else {
          // Add field to current row
          currentRow.push(field);
          currentRowWidth += fieldWidth;

          // If row is exactly full, push it and reset
          if (currentRowWidth === 12) {
            fieldRows.push(currentRow);
            currentRow = [];
            currentRowWidth = 0;
          }
        }
      }
    });

    // Push any remaining fields
    if (currentRow.length > 0) {
      fieldRows.push(currentRow);
    }

    const renderField = (field: AppFormField) => {
      const fieldName = `field_${field.acuityFieldId}`;
      const label = field.customLabel || field.acuityField?.name || "";
      const placeholder = field.placeholderText || "";
      const fieldType = field.acuityField?.type;
      const customType = field.customFieldType;

      return (
        <formInstance.Field
          name={fieldName}
          validators={{
            onChange: ({ value }) => {
              // Basic validation
              if (field.isRequired && !value) {
                return `${label} is required`;
              }

              // Email validation
              if ((field.validationRules.type === "email" || customType === "email") && value) {
                const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                if (!emailRegex.test(value as string)) {
                  return field.validationRules.message || "Invalid email address";
                }
              }

              // Phone validation
              if ((field.validationRules.type === "phone" || customType === "phone") && value) {
                const phoneRegex = /^[\d\s()+-]+$/;
                if (!phoneRegex.test(value as string)) {
                  return field.validationRules.message || "Invalid phone number";
                }
              }

              // Pattern validation
              if (field.validationRules.pattern && value) {
                const pattern = new RegExp(field.validationRules.pattern);
                if (!pattern.test(value as string)) {
                  return field.validationRules.message || "Invalid format";
                }
              }

              // Length validations
              if (
                field.validationRules.minLength &&
                value &&
                (value as string).length < field.validationRules.minLength
              ) {
                return (
                  field.validationRules.message ||
                  `Minimum length is ${field.validationRules.minLength}`
                );
              }

              if (
                field.validationRules.maxLength &&
                value &&
                (value as string).length > field.validationRules.maxLength
              ) {
                return (
                  field.validationRules.message ||
                  `Maximum length is ${field.validationRules.maxLength}`
                );
              }

              return undefined;
            },
          }}
        >
          {(fieldApi) => {
            const error = fieldApi.state.meta.errors?.[0];

            // Handle different field types
            if (fieldType === "textarea") {
              return (
                <>
                  <Textarea
                    value={(fieldApi.state.value as string) || ""}
                    onChange={(e) => fieldApi.handleChange(e.target.value)}
                    onBlur={fieldApi.handleBlur}
                    placeholder={placeholder}
                    className={cn(error && "border-destructive")}
                    rows={4}
                  />
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            if (fieldType === "dropdown" && field.acuityField?.options) {
              return (
                <>
                  <Select
                    value={(fieldApi.state.value as string) || ""}
                    onValueChange={(v) => fieldApi.handleChange(v)}
                  >
                    <SelectTrigger className={cn("w-full", error && "border-destructive")}>
                      <SelectValue placeholder={placeholder || "Select an option"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.acuityField.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            if (fieldType === "checkbox") {
              return (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={fieldName}
                      checked={Boolean(fieldApi.state.value) || false}
                      onCheckedChange={(checked) => fieldApi.handleChange(!!checked)}
                    />
                    <Label htmlFor={fieldName} className="text-sm font-normal">
                      {label}
                    </Label>
                  </div>
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            if (fieldType === "checkboxlist" && field.acuityField?.options) {
              const currentValue = (fieldApi.state.value as string[]) || [];
              return (
                <>
                  <div className="space-y-2">
                    {field.acuityField.options.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${fieldName}_${option}`}
                          checked={currentValue.includes(option)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              fieldApi.handleChange([...currentValue, option]);
                            } else {
                              fieldApi.handleChange(currentValue.filter((v) => v !== option));
                            }
                          }}
                        />
                        <Label htmlFor={`${fieldName}_${option}`} className="text-sm font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            if (fieldType === "yesno") {
              return (
                <>
                  <RadioGroup
                    value={(fieldApi.state.value as string) || ""}
                    onValueChange={(v) => fieldApi.handleChange(v)}
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${fieldName}_yes`} />
                        <Label htmlFor={`${fieldName}_yes`}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${fieldName}_no`} />
                        <Label htmlFor={`${fieldName}_no`}>No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            // Handle Date of Birth field type
            if (customType === "dob") {
              const dateValue = fieldApi.state.value
                ? parse(fieldApi.state.value as string, "yyyy-MM-dd", new Date())
                : undefined;
              const maxDate = new Date(); // Today
              const minDate = new Date(maxDate.getFullYear() - 120, 0, 1); // 120 years ago

              return (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateValue && "text-muted-foreground",
                          error && "border-destructive"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateValue && isValid(dateValue) ? (
                          format(dateValue, "PPP")
                        ) : (
                          <span>{placeholder || "Pick a date"}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue && isValid(dateValue) ? dateValue : undefined}
                        onSelect={(date) => {
                          if (date) {
                            fieldApi.handleChange(format(date, "yyyy-MM-dd"));
                          }
                        }}
                        disabled={(date) => date > maxDate || date < minDate}
                        captionLayout="dropdown"
                        fromYear={minDate.getFullYear()}
                        toYear={maxDate.getFullYear()}
                        defaultMonth={
                          dateValue && isValid(dateValue)
                            ? dateValue
                            : new Date(maxDate.getFullYear() - 30, 0)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            // Handle phone fields with PhoneNumberInput
            if (customType === "phone" || field.validationRules.type === "phone") {
              return (
                <>
                  <PhoneNumberInput
                    value={(fieldApi.state.value as string) || ""}
                    onChange={(value: string) => fieldApi.handleChange(value)}
                    onBlur={fieldApi.handleBlur}
                    placeholder={placeholder || "0400 000 000"}
                    className={cn(error && "border-destructive")}
                  />
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </>
              );
            }

            // Default to textbox with custom type handling
            const inputType =
              customType === "email"
                ? "email"
                : customType === "number"
                  ? "number"
                  : customType === "date"
                    ? "date"
                    : customType === "time"
                      ? "time"
                      : customType === "url"
                        ? "url"
                        : "text";

            return (
              <>
                <Input
                  type={inputType}
                  value={(fieldApi.state.value as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  placeholder={placeholder}
                  className={cn(error && "border-destructive")}
                />
                {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              </>
            );
          }}
        </formInstance.Field>
      );
    };

    return (
      <TooltipProvider>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            formInstance.handleSubmit();
          }}
          className={cn("space-y-6", className)}
        >
          {fieldRows.map((row, rowIndex) => {
            return (
              <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {row.map((field) => {
                  const fieldName = `field_${field.acuityFieldId}`;
                  const label = field.customLabel || field.acuityField?.name || "";
                  const isCheckbox = field.acuityField?.type === "checkbox";

                  // Determine column span based on field width
                  const colSpan =
                    field.displayWidth === "full"
                      ? "md:col-span-12"
                      : field.displayWidth === "half"
                        ? "md:col-span-6"
                        : "md:col-span-4";

                  if (isCheckbox) {
                    return (
                      <div key={field.id} className={cn("space-y-1", colSpan)}>
                        {renderField(field)}
                        {field.helpText && (
                          <p className="text-sm text-muted-foreground">{field.helpText}</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={field.id} className={cn("space-y-2", colSpan)}>
                      {label && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={fieldName}>
                            {label}
                            {field.isRequired && <span className="text-destructive">*</span>}
                          </Label>
                          {field.tooltipText && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{field.tooltipText}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                      {renderField(field)}
                      {field.helpText && (
                        <p className="text-sm text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          {!hideSubmitButton && (
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          )}
        </form>
      </TooltipProvider>
    );
  }
);

AppFormRenderer.displayName = "AppFormRenderer";
