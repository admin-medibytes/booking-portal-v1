"use client";

import { useState } from "react";
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
// Removed unused imports: Button, Label, Checkbox
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface CancelBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingDetails?: {
    examineeName: string;
    appointmentDate: string;
    appointmentTime: string;
  };
  onCancelSuccess?: () => void;
}

export function CancelBookingModal({
  open,
  onOpenChange,
  bookingId,
  bookingDetails,
  onCancelSuccess,
}: CancelBookingModalProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isNoShow, setIsNoShow] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noShow: isNoShow,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel appointment");
      }

      toast.success(
        isNoShow
          ? "Booking marked as no-show successfully"
          : "Appointment cancelled successfully"
      );

      onOpenChange(false);
      setIsNoShow(false);

      if (onCancelSuccess) {
        onCancelSuccess();
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel appointment");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <AlertDialog open={open && !isCancelling} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancel Appointment
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {bookingDetails ? (
                  <div className="space-y-2 py-3">
                    <div className="font-medium text-foreground">
                      Are you sure you want to cancel this appointment?
                    </div>
                    <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                      <div>
                        <span className="font-medium">Examinee:</span>{" "}
                        {bookingDetails.examineeName}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>{" "}
                        {bookingDetails.appointmentDate}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>{" "}
                        {bookingDetails.appointmentTime}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>Are you sure you want to cancel this appointment?</div>
                )}

                {/* <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="noShow"
                    checked={isNoShow}
                    onCheckedChange={(checked) => setIsNoShow(checked === true)}
                    disabled={isCancelling}
                  />
                  <Label
                    htmlFor="noShow"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Mark as no-show (patient did not attend)
                  </Label>
                </div> */}

                <div className="text-xs text-muted-foreground pt-2">
                  This action cannot be undone. The appointment will be cancelled in the
                  scheduling system.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Appointment
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading Modal */}
      <AlertDialog open={isCancelling}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogTitle className="sr-only">
            Cancelling Appointment
          </AlertDialogTitle>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Cancelling Appointment</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we cancel your appointment...
              </p>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
