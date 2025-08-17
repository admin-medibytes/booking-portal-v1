import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { BookingProgress } from "@/types/booking";

interface BookingProgressTrackerProps {
  currentProgress: string;
  progressHistory: (BookingProgress & {
    changedBy?: {
      name: string;
      email: string;
    };
  })[];
  canUpdateProgress: boolean;
  onUpdateClick: () => void;
}

const progressStageLabels: Record<string, string> = {
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  "no-show": "No Show",
  "generating-report": "Generating Report",
  "report-generated": "Report Generated",
  "payment-received": "Payment Received",
};

const progressStageColors: Record<string, string> = {
  scheduled: "default",
  rescheduled: "secondary",
  cancelled: "destructive",
  "no-show": "destructive",
  "generating-report": "default",
  "report-generated": "default",
  "payment-received": "default",
};

export function BookingProgressTracker({
  currentProgress,
  progressHistory,
  canUpdateProgress,
  onUpdateClick,
}: BookingProgressTrackerProps) {
  const getProgressColor = (status: string) => {
    return progressStageColors[status] || "secondary";
  };

  const getProgressLabel = (status: string) => {
    return progressStageLabels[status] || status;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Progress Tracker
          </CardTitle>
          {canUpdateProgress && (
            <Button size="sm" onClick={onUpdateClick}>
              Update Progress
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Progress */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              <Badge variant={getProgressColor(currentProgress) as "default" | "secondary" | "destructive" | "outline"} className="text-sm">
                {getProgressLabel(currentProgress)}
              </Badge>
            </div>
            <div className="text-sm text-gray-500">Current Stage</div>
          </div>

          {/* Progress History */}
          {progressHistory.length > 0 && (
            <>
              <div className="text-sm font-medium text-gray-700 mt-6 mb-3">History</div>
              <div className="space-y-3">
                {progressHistory.map((progress, index) => (
                  <div key={progress.id} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index === 0 ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      />
                      {index < progressHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 absolute top-3" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {progress.fromStatus && (
                              <>
                                <Badge
                                  variant={getProgressColor(progress.fromStatus) as "default" | "secondary" | "destructive" | "outline"}
                                  className="text-xs"
                                >
                                  {getProgressLabel(progress.fromStatus)}
                                </Badge>
                                <span className="text-gray-400">→</span>
                              </>
                            )}
                            <Badge
                              variant={getProgressColor(progress.toStatus) as "default" | "secondary" | "destructive" | "outline"}
                              className="text-xs"
                            >
                              {getProgressLabel(progress.toStatus)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            <span>{progress.changedBy?.name || "System"}</span>
                            {(progress.metadata as { impersonatedUserId?: string })?.impersonatedUserId && (
                              <div className="flex items-center gap-1 text-amber-600">
                                <AlertCircle className="w-3 h-3" />
                                <span>via impersonation</span>
                              </div>
                            )}
                          </div>
                          {progress.reason && (
                            <p className="mt-2 text-sm text-gray-600">{progress.reason}</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          <div title={format(new Date(progress.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(progress.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {progressHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No progress history available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}