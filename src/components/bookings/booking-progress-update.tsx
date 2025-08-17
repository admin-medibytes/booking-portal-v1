"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { type } from "arktype";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const progressUpdateSchema = type({
  progress: '"scheduled"|"rescheduled"|"cancelled"|"no-show"|"generating-report"|"report-generated"|"payment-received"',
  notes: 'string | undefined',
});

// type ProgressUpdateFormData = typeof progressUpdateSchema.infer;

interface BookingProgressUpdateProps {
  bookingId: string;
  currentProgress: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const validTransitions: Record<string, string[]> = {
  scheduled: ["rescheduled", "cancelled", "no-show", "generating-report"],
  rescheduled: ["cancelled", "no-show", "generating-report"],
  cancelled: [],
  "no-show": [],
  "generating-report": ["report-generated"],
  "report-generated": ["payment-received"],
  "payment-received": [],
};

const progressLabels: Record<string, string> = {
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  "no-show": "No Show",
  "generating-report": "Generating Report",
  "report-generated": "Report Generated",
  "payment-received": "Payment Received",
};

export function BookingProgressUpdate({
  bookingId,
  currentProgress,
  isOpen,
  onClose,
  onSuccess,
}: BookingProgressUpdateProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTransitions = validTransitions[currentProgress] || [];
  const isTerminalState = availableTransitions.length === 0;

  const form = useForm({
    defaultValues: {
      progress: availableTransitions[0] || "",
      notes: "",
    },
    validators: {
      onChange: ({ value }) => {
        const result = progressUpdateSchema(value);
        if (result instanceof type.errors) {
          return result[0].message;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(`/api/bookings/${bookingId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update progress");
        }

        onSuccess();
        onClose();
        form.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Booking Progress</DialogTitle>
          <DialogDescription>
            Change the progress status of this booking. This action will be logged.
          </DialogDescription>
        </DialogHeader>

        {isTerminalState ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This booking is in a terminal state ({progressLabels[currentProgress]}) and cannot be
              updated further.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="progress">New Progress Status</Label>
                <form.Field name="progress">
                  {(field) => (
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger id="progress">
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransitions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {progressLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <form.Field name="notes">
                  {(field) => (
                    <Textarea
                      id="notes"
                      placeholder="Add any relevant notes about this status change..."
                      className="min-h-[80px]"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                </form.Field>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.state.isValid}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Progress
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}