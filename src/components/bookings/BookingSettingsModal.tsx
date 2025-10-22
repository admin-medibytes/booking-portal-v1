"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Building2, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { timeZones } from "@/lib/utils/timezones";
import { cn } from "@/lib/utils";

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
  defaultTimezone,
  defaultOrganizationId,
}: BookingSettingsModalProps) {
  const [selectedTimezone, setSelectedTimezone] = useState(defaultTimezone);
  const [selectedOrganization, setSelectedOrganization] = useState(defaultOrganizationId || "");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [orgComboboxOpen, setOrgComboboxOpen] = useState(false);

  // Fetch organizations
  const {
    data: organizationsData,
    isLoading,
    error,
  } = useQuery({
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
        // Try to find organization with slug "medibytes-legal"
        const medibytesLegal = organizationsData.find((org) => org.slug === "medibytes-legal");
        // Use medibytes-legal if found, otherwise use first organization
        setSelectedOrganization(medibytesLegal?.id || organizationsData[0].id);
      }
      setHasLoaded(true);
    }
  }, [organizationsData, defaultOrganizationId, hasLoaded]);

  const handleConfirm = () => {
    if (selectedTimezone && selectedOrganization && organizationsData) {
      const selectedOrg = organizationsData.find((org) => org.id === selectedOrganization);
      if (selectedOrg) {
        onConfirm(selectedTimezone, selectedOrganization, selectedOrg.slug);
      }
    }
  };

  const canConfirm = selectedTimezone && selectedOrganization;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Booking Settings</AlertDialogTitle>
          <AlertDialogDescription>
            Please confirm your timezone and organization for this booking session.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          {/* Timezone Selection */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger
                id="timezone"
                className="w-full justify-between hover:cursor-pointer bg-background transition-colors duration-100 delay-50 hover:bg-accent"
                style={{ transitionProperty: 'background-color' }}
              >
                <SelectValue placeholder="Select timezone">
                  {timeZones.find((tz) => tz.tzCode === selectedTimezone)?.tzCode ||
                    selectedTimezone}
                </SelectValue>
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
              <Popover open={orgComboboxOpen} onOpenChange={setOrgComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="organization"
                    variant="outline"
                    role="combobox"
                    aria-expanded={orgComboboxOpen}
                    className="w-full justify-between"
                  >
                    {selectedOrganization
                      ? organizationsData?.find((org) => org.id === selectedOrganization)?.name
                      : "Select organization..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search organizations..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No organization found.</CommandEmpty>
                      <CommandGroup>
                        {organizationsData?.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={org.name}
                            onSelect={() => {
                              setSelectedOrganization(org.id);
                              setOrgComboboxOpen(false);
                            }}
                          >
                            {org.name}
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedOrganization === org.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <p className="text-sm text-muted-foreground">
              Bookings will be created under this organization
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <Button onClick={handleConfirm} disabled={!canConfirm || isLoading}>
            Confirm Settings
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
