"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Building2, AlertCircle } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { timeZones } from "@/lib/utils/timezones";

interface BookingSettingsModalProps {
  isOpen: boolean;
  onConfirm: (timezone: string, organizationId: string, organizationSlug: string) => void;
  defaultTimezone?: string;
  defaultOrganizationId?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

// Australian timezone options
const australianTimezones = timeZones.filter((tz) => tz.label.includes("Australia"));

export function BookingSettingsModal({
  isOpen,
  onConfirm,
  defaultTimezone = "Australia/Sydney",
  defaultOrganizationId,
}: BookingSettingsModalProps) {
  const [selectedTimezone, setSelectedTimezone] = useState(defaultTimezone);
  const [selectedOrganization, setSelectedOrganization] = useState(defaultOrganizationId || "");
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch organizations
  const { data: organizationsData, isLoading, error } = useQuery({
    queryKey: ["organizations-for-booking"],
    queryFn: async () => {
      const response = await adminClient.organizations.$get({
        query: {
          limit: "100",
          page: "1",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch organizations");
      }
      
      const result = await response.json();
      return result.organizations as Organization[];
    },
    enabled: isOpen,
  });

  // Set default organization when data loads
  useEffect(() => {
    if (organizationsData && organizationsData.length > 0 && !hasLoaded) {
      if (!defaultOrganizationId) {
        setSelectedOrganization(organizationsData[0].id);
      }
      setHasLoaded(true);
    }
  }, [organizationsData, defaultOrganizationId, hasLoaded]);

  const handleConfirm = () => {
    if (selectedTimezone && selectedOrganization && organizationsData) {
      const selectedOrg = organizationsData.find(org => org.id === selectedOrganization);
      if (selectedOrg) {
        onConfirm(selectedTimezone, selectedOrganization, selectedOrg.slug);
      }
    }
  };

  const canConfirm = selectedTimezone && selectedOrganization;

  return (
    <Dialog open={isOpen} modal>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Confirm Booking Settings</DialogTitle>
          <DialogDescription>
            Please confirm your timezone and organization for this booking session.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Timezone Selection */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <Select
              value={selectedTimezone}
              onValueChange={setSelectedTimezone}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {australianTimezones.map((tz) => (
                  <SelectItem key={tz.tzCode} value={tz.tzCode}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This timezone will be used for displaying appointment times
            </p>
          </div>

          {/* Organization Selection */}
          <div className="space-y-2">
            <Label htmlFor="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </Label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load organizations. Please refresh and try again.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={selectedOrganization}
                onValueChange={setSelectedOrganization}
              >
                <SelectTrigger id="organization">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizationsData?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-sm text-muted-foreground">
              Bookings will be created under this organization
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleConfirm} 
            disabled={!canConfirm || isLoading}
          >
            Confirm Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}