"use client";

import { useQuery } from "@tanstack/react-query";
import { specialistsClient } from "@/lib/hono-client";
import { handleApiResponse } from "@/lib/hono-utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, FileText, Calendar, Check, Video, Users } from "lucide-react";
import { getInitials } from "@/lib/utils/initials";
import type { Specialist } from "@/types/specialist";

interface AppointmentType {
  id: string;
  acuityAppointmentTypeId: number;
  name: string;
  description: string | null;
  duration: number;
  category: string | null;
  appointmentMode?: "in-person" | "telehealth";
  source: {
    name: "acuity" | "override";
    description: "acuity" | "override";
  };
}

interface AppointmentTypeSelectProps {
  specialistId: string;
  onSelect: (appointmentType: AppointmentType) => void;
  selectedAppointmentType: AppointmentType | null;
}

export function AppointmentTypeSelect({
  specialistId,
  onSelect,
  selectedAppointmentType,
}: AppointmentTypeSelectProps) {
  // Fetch specialist data
  const { data: specialist } = useQuery<Specialist>({
    queryKey: ["specialists", specialistId],
    queryFn: async () => {
      const response = specialistsClient[":id"].$get({
        param: { id: specialistId },
      });
      const result = await handleApiResponse<Specialist>(response);
      return result;
    },
    enabled: !!specialistId,
  });

  const {
    data: appointmentTypes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["appointment-types", specialistId],
    queryFn: async () => {
      const response = specialistsClient[":id"]["appointment-types"].$get({
        param: { id: specialistId },
      });

      const result = await handleApiResponse<AppointmentType[]>(response);
      return result;
    },
    enabled: !!specialistId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load appointment types. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!appointmentTypes || appointmentTypes.length === 0) {
    return (
      <Alert>
        <AlertDescription>No appointment types are currently available.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {specialist && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/30">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 ring-2 ring-white shadow-lg">
              {specialist.image && <AvatarImage src={specialist.image} alt={specialist.name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/30 text-xl font-semibold text-primary/80">
                {getInitials(`${specialist.user.firstName} ${specialist.user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-slate-900">{specialist.name}</h3>
              <p className="text-primary text-sm font-medium tracking-wide">
                {specialist.user.jobTitle}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Appointment Types</h3>

        {appointmentTypes.map((appointmentType) => {
          // Choose icon based on appointment mode
          const Icon =
            appointmentType.appointmentMode === "telehealth"
              ? Video
              : appointmentType.appointmentMode === "in-person"
                ? Users
                : FileText; // Default icon if mode not specified
          const isSelected = selectedAppointmentType?.id === appointmentType.id;

          return (
            <div
              key={appointmentType.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
                isSelected
                  ? "bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30 shadow-md shadow-primary/20"
                  : "bg-white border-slate-200 hover:border-primary/50 hover:bg-slate-50/50"
              )}
              onClick={() => onSelect(appointmentType)}
            >
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                  isSelected
                    ? "bg-gradient-to-b from-primary to-primary/80"
                    : "bg-transparent group-hover:bg-primary/50"
                )}
              />

              <div className="flex items-center gap-6 p-6 pl-8">
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                      isSelected
                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                        : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-lg">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-1">
                        {appointmentType.name}
                      </h4>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {appointmentType.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">
                        {appointmentType.duration} min
                      </span>
                    </div>
                    {appointmentType.category && (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {appointmentType.category}
                      </Badge>
                    )}
                    {appointmentType.source.name === "override" && (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                        Customized
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <Button
                    size="sm"
                    className={cn(
                      "gap-2 min-w-[100px] transition-all duration-200 rounded",
                      isSelected
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25"
                        : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(appointmentType);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4" />
                        Select
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
