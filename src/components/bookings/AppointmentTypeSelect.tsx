"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "lucide-react";
import { specialistsClient } from "@/lib/hono-client";
import { handleApiResponse } from "@/lib/hono-utils";

interface AppointmentType {
  id: number;
  name: string;
  duration: number;
  description?: string;
  category: string;
}

interface AppointmentTypeSelectProps {
  specialistId: string;
  onSelect: (appointmentType: AppointmentType) => void;
  selectedAppointmentType: AppointmentType | null;
}

export function AppointmentTypeSelect({ 
  specialistId, 
  onSelect, 
  selectedAppointmentType 
}: AppointmentTypeSelectProps) {
  const { data: appointmentTypes, isLoading, error } = useQuery({
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
        <AlertDescription>
          No appointment types are currently available.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {appointmentTypes.map((appointmentType) => {
        const isSelected = selectedAppointmentType?.id === appointmentType.id;
        
        return (
          <Card
            key={appointmentType.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected ? "ring-2 ring-primary ring-offset-2" : ""
            }`}
            onClick={() => onSelect(appointmentType)}
          >
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-base mb-1">{appointmentType.name}</h3>
                  {appointmentType.category && (
                    <Badge variant="secondary" className="mb-2">
                      {appointmentType.category}
                    </Badge>
                  )}
                </div>
                
                {appointmentType.description && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{appointmentType.description}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{appointmentType.duration} minutes</span>
                </div>
                
                <Button
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(appointmentType);
                  }}
                >
                  {isSelected ? "Selected" : "Select"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}