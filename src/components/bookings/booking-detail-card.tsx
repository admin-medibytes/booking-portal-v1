import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  User,
  Phone,
  Calendar,
  Clock4,
  MapPin,
  XCircle,
  Video,
  Clock,
  VideoIcon,
  Briefcase,
  FileText,
  AlertCircle,
  Trash2,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import { format, addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { BookingWithSpecialist } from "@/types/booking";
import { useState } from "react";
import { timeZones } from "@/lib/utils/timezones";
import { toast } from "sonner";

interface BookingDetailCardProps {
  booking: BookingWithSpecialist;
}

// Filter for Australian timezones only
const australianTimezones = timeZones.filter((tz) => tz.label.includes("Australia"));

export function BookingDetailCard({ booking }: BookingDetailCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Get user's default timezone
  const getUserTimezone = () => {
    if (typeof window !== "undefined") {
      // Always use browser's timezone as default
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return "UTC";
  };

  const [selectedTimezone, setSelectedTimezone] = useState(getUserTimezone());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success text-success-foreground";
      case "closed":
        return "bg-muted text-muted-foreground";
      case "archived":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Format date/time in selected timezone
  const formatDateInTimezone = (date: Date | string) => {
    if (!date) return "Not scheduled";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatInTimeZone(dateObj, selectedTimezone, "EEEE, MMMM d, yyyy");
  };

  const formatTimeInTimezone = (date: Date | string, formatStr: string = "h:mm a") => {
    if (!date) return "Not scheduled";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatInTimeZone(dateObj, selectedTimezone, formatStr);
  };

  // Calculate end time based on duration
  const getEndTime = () => {
    if (!booking.dateTime || !booking.duration) return null;
    return addMinutes(new Date(booking.dateTime), booking.duration);
  };

  // Quick action handlers
  const handleJoinMeeting = () => {
    setLoadingAction("join");
    // TODO: Implement join meeting logic
    toast.info("Join meeting feature coming soon!");
    setLoadingAction(null);
  };

  const handleReschedule = () => {
    setLoadingAction("reschedule");
    // TODO: Implement reschedule logic
    toast.info("Reschedule feature coming soon!");
    setLoadingAction(null);
  };

  const handleSendReminder = () => {
    setLoadingAction("reminder");
    // TODO: Implement send reminder logic
    toast.info("Send reminder feature coming soon!");
    setLoadingAction(null);
  };

  const handleDownloadReceipt = () => {
    setLoadingAction("download");
    // TODO: Implement download receipt logic
    toast.info("Download receipt feature coming soon!");
    setLoadingAction(null);
  };

  const handleCancel = () => {
    setLoadingAction("cancel");
    // TODO: Implement cancel logic
    toast.info("Cancel feature coming soon!");
    setLoadingAction(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Appointment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Specialist Info */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-16 w-16">
                <AvatarImage src="/placeholder.svg" alt={booking.specialist?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {booking.specialist?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("") || "NA"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{booking.specialist.name}</h3>
                <p className="text-muted-foreground">{booking.specialist.jobTitle}</p>
              </div>
            </div>

            {/* Appointment Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Service Type</p>
                    <p className="font-medium capitalize">{booking.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {booking.type === "telehealth" ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <MapPin className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {booking.type === "telehealth" ? "Meeting Room" : "Location"}
                    </p>
                    <p className="font-medium text-balance">{booking.location}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {booking.dateTime ? formatDateInTimezone(booking.dateTime) : "Not scheduled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {booking.dateTime && getEndTime()
                        ? `${formatTimeInTimezone(booking.dateTime)} - ${formatTimeInTimezone(getEndTime()!)} (${booking.duration} min)`
                        : "Not scheduled"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Examinee & Referrer Information */}
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Examinee Section */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Examinee Information
                </h4>
                <div className="space-y-2">
                  {booking.examinee ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">
                          {booking.examinee.firstName} {booking.examinee.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{booking.examinee.email || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">
                          {booking.examinee.phoneNumber || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Birth</p>
                        <p className="font-medium">
                          {booking.examinee.dateOfBirth || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">{booking.examinee.address}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No examinee information available
                    </p>
                  )}
                </div>
              </div>

              {/* Referrer Section */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Referrer Information
                </h4>
                <div className="space-y-2">
                  {booking.referrer ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">
                          {booking.referrer.firstName} {booking.referrer.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{booking.referrer.email || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{booking.referrer.phone || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Organization</p>
                        <p className="font-medium">
                          {booking.referrerOrganization?.name || "Not specified"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No referrer information available
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Case Information */}
            {(booking.examinee?.condition ||
              booking.examinee?.caseType ||
              booking.examinee?.address) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    Case Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {booking.examinee?.condition && (
                      <div>
                        <p className="text-sm text-muted-foreground">Condition</p>
                        <p className="font-medium">{booking.examinee.condition}</p>
                      </div>
                    )}
                    {booking.examinee?.caseType && (
                      <div>
                        <p className="text-sm text-muted-foreground">Case Type</p>
                        <p className="font-medium">{booking.examinee.caseType}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-muted rounded">IME</span>
                <span className="px-2 py-1 bg-muted rounded">Supplementary</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Consent Form</p>
                <Button variant="ghost" size="sm" className="h-8">
                  Upload
                </Button>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No files uploaded</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Brief Documents</p>
                <Button variant="ghost" size="sm" className="h-8">
                  Upload
                </Button>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No files uploaded</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Dictation</p>
                <Button variant="ghost" size="sm" className="h-8">
                  Upload
                </Button>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No files uploaded</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Draft Reports</p>
                <Button variant="ghost" size="sm" className="h-8">
                  Upload
                </Button>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No files uploaded</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Final Report</p>
                <Button variant="ghost" size="sm" className="h-8">
                  Upload
                </Button>
              </div>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No files uploaded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="lg:sticky lg:top-6 self-start space-y-6">
        {/* Booking Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Examinee</span>
              <span className="font-medium text-right">
                {booking.examinee
                  ? `${booking.examinee.firstName} ${booking.examinee.lastName}`
                  : "Not specified"}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Specialist</span>
              <span className="font-medium text-right">
                {booking.specialist?.name || "Not assigned"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {booking.dateTime
                  ? formatInTimeZone(new Date(booking.dateTime), selectedTimezone, "MMM dd, yyyy")
                  : "Not scheduled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {booking.dateTime ? formatTimeInTimezone(booking.dateTime) : "Not scheduled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Appointment</span>
              <span className="font-medium capitalize">
                {booking.type === "telehealth" ? "Telehealth" : "In-person"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={getStatusColor(booking.status)}>
                {formatStatus(booking.status)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium capitalize">
                {(booking as any).currentProgress || "Scheduled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact Authorized</span>
              <span className="font-medium">
                {booking.examinee?.authorizedContact ? "Yes" : "No"}
              </span>
            </div>

            {/* Timezone Selector */}

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-medium">Timezone</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-auto justify-between gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="text-xs">
                      {timeZones.find((tz) => tz.tzCode === selectedTimezone)?.label ||
                        selectedTimezone}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-2" align="end">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {australianTimezones.map((tz) => (
                        <div
                          key={tz.tzCode}
                          className={cn(
                            "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                            selectedTimezone === tz.tzCode && "bg-accent"
                          )}
                          onClick={() => setSelectedTimezone(tz.tzCode)}
                        >
                          <span>{tz.label}</span>
                          {selectedTimezone === tz.tzCode && <Check className="h-4 w-4" />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.type === "telehealth" && (
              <Button
                className="w-full bg-transparent"
                variant="outline"
                onClick={handleJoinMeeting}
                disabled={loadingAction === "join"}
              >
                <VideoIcon className="h-4 w-4 mr-2" />
                Join Video Call
              </Button>
            )}
            <Button
              className="w-full bg-transparent"
              variant="outline"
              onClick={handleReschedule}
              disabled={loadingAction === "reschedule"}
            >
              <Clock4 className="h-4 w-4 mr-2" />
              Reschedule Appointment
            </Button>

            {/* <Button
              className="w-full bg-transparent"
              variant="outline"
              onClick={handleSendReminder}
              disabled={loadingAction === "reminder"}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Reminder
            </Button> */}

            <Button
              className="w-full"
              variant="destructive"
              onClick={handleCancel}
              disabled={loadingAction === "cancel"}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Booking
            </Button>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact our support team for assistance with your booking.
            </p>
            <Button className="w-full bg-transparent" variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
