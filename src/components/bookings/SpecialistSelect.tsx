"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MapPin, Video, User, MapPinned } from "lucide-react";
import { specialistsClient } from "@/lib/hono-client";
import { 
  formatLocationShort, 
  getLocationDisplay,
  getAppointmentTypeDisplay 
} from "@/lib/utils/location";
import { handleApiResponse } from "@/lib/hono-utils";
import type { Specialist } from "@/types/specialist";

interface SpecialistSelectProps {
  onSelect: (specialist: Specialist) => void;
  selectedSpecialist: Specialist | null;
}

export function SpecialistSelect({ onSelect, selectedSpecialist }: SpecialistSelectProps) {
  const { data: specialists, isLoading, error } = useQuery({
    queryKey: ["specialists"],
    queryFn: async () => {
      const response = specialistsClient.$get();
      return await handleApiResponse<Specialist[]>(response);
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full mt-4" />
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
          Failed to load specialists. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!specialists || specialists.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No specialists are currently available. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {specialists.map((specialist) => {
        const isSelected = selectedSpecialist?.id === specialist.id;
        
        return (
          <Card
            key={specialist.id}
            className={isSelected ? "border-primary" : ""}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{specialist.name}</CardTitle>
                </div>
                {isSelected && (
                  <Badge variant="default">Selected</Badge>
                )}
              </div>
              <CardDescription>{specialist.user?.jobTitle || "Specialist"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {/* Appointment Type Badges */}
                <div className="flex gap-2 flex-wrap">
                  {specialist.acceptsInPerson && (
                    <Badge variant="outline" className="text-xs">
                      <MapPinned className="w-3 h-3 mr-1" />
                      In-person
                    </Badge>
                  )}
                  {specialist.acceptsTelehealth && (
                    <Badge variant="outline" className="text-xs">
                      <Video className="w-3 h-3 mr-1" />
                      Telehealth
                    </Badge>
                  )}
                </div>

                {/* Location Display */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {getLocationDisplay(
                      specialist.acceptsInPerson || false, 
                      specialist.acceptsTelehealth || true,
                      specialist.location
                    )}
                  </span>
                </div>
              </div>
              <Button
                className="w-full"
                variant={isSelected ? "secondary" : "default"}
                onClick={() => onSelect(specialist)}
              >
                {isSelected ? "Selected" : "Select Specialist"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}