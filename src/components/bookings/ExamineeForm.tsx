"use client";

import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, Mail, User, FileText, AlertCircle } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

const examineeSchema = type({
  examineeName: "string>0",
  examineePhone: "string>0",
  "examineeEmail?": "string.email|null",
  appointmentType: "'in_person'|'telehealth'",
  "notes?": "string|null",
});

type ExamineeFormData = typeof examineeSchema.infer;

interface ExamineeFormProps {
  onSubmit: (data: ExamineeFormData) => void;
  defaultValues?: ExamineeFormData;
}

export function ExamineeForm({ onSubmit, defaultValues }: ExamineeFormProps) {
  const form = useForm({
    defaultValues: defaultValues || {
      examineeName: "",
      examineePhone: "",
      examineeEmail: null,
      appointmentType: "in_person" as const,
      notes: null,
    },
    onSubmit: async ({ value }) => {
      // Sanitize all string inputs
      const sanitizedData: ExamineeFormData = {
        examineeName: DOMPurify.sanitize(value.examineeName),
        examineePhone: DOMPurify.sanitize(value.examineePhone),
        examineeEmail: value.examineeEmail ? DOMPurify.sanitize(value.examineeEmail) : null,
        appointmentType: value.appointmentType,
        notes: value.notes ? DOMPurify.sanitize(value.notes) : null,
      };

      // Validate with ArkType
      const result = examineeSchema(sanitizedData);
      if (result instanceof type.errors) {
        // Handle validation errors
        return;
      }

      onSubmit(sanitizedData);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Examinee Information
        </CardTitle>
        <CardDescription>
          Please provide the details of the person being examined
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Name Field */}
          <form.Field
            name="examineeName"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "Name is required";
                if (value.length < 2) return "Name must be at least 2 characters";
                if (value.length > 100) return "Name must be less than 100 characters";
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name *
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="John Doe"
                />
                {field.state.meta.errors && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{field.state.meta.errors[0]}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </form.Field>

          {/* Phone Field */}
          <form.Field
            name="examineePhone"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "Phone number is required";
                const phoneRegex = /^[\d\s\-\(\)\+]+$/;
                if (!phoneRegex.test(value)) return "Invalid phone number format";
                const digitsOnly = value.replace(/\D/g, "");
                if (digitsOnly.length < 10) return "Phone number must be at least 10 digits";
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number *
                </Label>
                <Input
                  id={field.name}
                  type="tel"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="(555) 123-4567"
                />
                {field.state.meta.errors && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{field.state.meta.errors[0]}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </form.Field>

          {/* Email Field */}
          <form.Field
            name="examineeEmail"
            validators={{
              onChange: ({ value }) => {
                if (value && !value.includes("@")) return "Invalid email format";
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address (Optional)
                </Label>
                <Input
                  id={field.name}
                  type="email"
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  placeholder="john.doe@example.com"
                />
                {field.state.meta.errors && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{field.state.meta.errors[0]}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </form.Field>

          {/* Appointment Type */}
          <form.Field name="appointmentType">
            {(field) => (
              <div className="space-y-2">
                <Label className="text-base">Appointment Type *</Label>
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(value: string) => field.handleChange(value as "in_person" | "telehealth")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="in_person" id="in_person" />
                    <Label htmlFor="in_person" className="font-normal cursor-pointer">
                      In-Person Examination
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="telehealth" id="telehealth" />
                    <Label htmlFor="telehealth" className="font-normal cursor-pointer">
                      Telehealth Examination
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </form.Field>

          {/* Notes Field */}
          <form.Field
            name="notes"
            validators={{
              onChange: ({ value }) => {
                if (value && value.length > 500) return "Notes must be less than 500 characters";
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Additional Notes (Optional)
                </Label>
                <Textarea
                  id={field.name}
                  value={field.state.value || ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  placeholder="Any special requirements or additional information..."
                  rows={4}
                />
                {field.state.meta.errors && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{field.state.meta.errors[0]}</AlertDescription>
                  </Alert>
                )}
                {field.state.value && (
                  <p className="text-sm text-muted-foreground">
                    {field.state.value.length}/500 characters
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Continue"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}