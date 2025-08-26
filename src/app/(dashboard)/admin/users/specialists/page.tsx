"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Stethoscope, MapPinned, Video, Filter, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { adminClient, specialistsClient } from "@/lib/hono-client";
import { SortableSpecialistGrid } from "./components/SortableSpecialistGrid";
import { SpecialistDetailDialog } from "./components/SpecialistDetailDialog";
import type { SpecialistLocation } from "@/types/specialist";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  slug: string;
  location: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    image?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export default function AdminSpecialistsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<
    "all" | "in_person" | "telehealth" | "on_request"
  >("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "has_location" | "no_location">(
    "all"
  );
  const [pendingPositions, setPendingPositions] = useState<Array<{
    id: string;
    position: number;
  }> | null>(null);
  const [localSpecialists, setLocalSpecialists] = useState<Specialist[] | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const queryClient = useQueryClient();

  // Fetch specialists
  const { data: specialists = [], isLoading } = useQuery({
    queryKey: ["admin-specialists", statusFilter, appointmentTypeFilter],
    queryFn: async () => {
      const query: Record<string, string> = {
        includeInactive: statusFilter === "all" || statusFilter === "inactive" ? "true" : "false",
      };

      if (appointmentTypeFilter !== "all") {
        query.appointmentType = appointmentTypeFilter;
      }

      const response = await adminClient.specialists.$get({ query });
      const json = await response.json();

      if ("error" in json) {
        toast.error("Failed to fetch specialists");
        return [];
      }

      return json.data;
    },
  });

  // Initialize local state when specialists data is first loaded or changes
  useEffect(() => {
    if (specialists && specialists.length > 0 && !pendingPositions) {
      setLocalSpecialists(specialists);
    }
  }, [specialists, pendingPositions]);

  // Update positions mutation
  const updatePositionsMutation = useMutation({
    mutationFn: async (positions: Array<{ id: string; position: number }>) => {
      const response = await specialistsClient.positions.$put({
        json: [...positions],
      });
      if (!response.ok) {
        throw new Error("Failed to update positions");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Positions updated successfully");
      setPendingPositions(null);
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
    },
    onError: () => {
      toast.error("Failed to update positions");
      // Reset to original positions on error
      setLocalSpecialists(specialists);
      setPendingPositions(null);
    },
  });

  // Use either local state or fetched data
  const displaySpecialists = localSpecialists || specialists;

  // Filter and sort specialists
  const filteredSpecialists = useMemo(() => {
    if (!displaySpecialists) return [];
    let filtered = displaySpecialists.filter((specialist) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        specialist.name.toLowerCase().includes(searchLower) ||
        specialist.user.email.toLowerCase().includes(searchLower) ||
        specialist.user.jobTitle.toLowerCase().includes(searchLower) ||
        (specialist.location?.city &&
          specialist.location.city.toLowerCase().includes(searchLower)) ||
        (specialist.location?.state &&
          specialist.location.state.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // Apply appointment type filter
      if (appointmentTypeFilter === "in_person" && !specialist.acceptsInPerson) return false;
      if (appointmentTypeFilter === "telehealth" && !specialist.acceptsTelehealth) return false;
      if (
        appointmentTypeFilter === "on_request" &&
        (specialist.acceptsInPerson || specialist.acceptsTelehealth)
      )
        return false;

      // Apply status filter
      if (statusFilter === "active" && !specialist.isActive) return false;
      if (statusFilter === "inactive" && specialist.isActive) return false;

      // Apply location filter
      if (locationFilter === "has_location" && !specialist.location) return false;
      if (locationFilter === "no_location" && specialist.location) return false;

      return true;
    });

    // Ensure sorted by position
    return filtered.sort((a, b) => a.position - b.position);
  }, [displaySpecialists, searchTerm, appointmentTypeFilter, statusFilter, locationFilter]);

  const handleReorder = (positions: Array<{ id: string; position: number }>) => {
    // Update local state immediately for responsive UI
    const currentSpecialists = localSpecialists || specialists;
    const updatedSpecialists = [...currentSpecialists];
    positions.forEach(({ id, position }) => {
      const index = updatedSpecialists.findIndex((s) => s.id === id);
      if (index !== -1) {
        updatedSpecialists[index] = { ...updatedSpecialists[index], position };
      }
    });
    setLocalSpecialists(updatedSpecialists.sort((a, b) => a.position - b.position));
    setPendingPositions(positions);
  };

  const handleSavePositions = () => {
    if (pendingPositions) {
      updatePositionsMutation.mutate(pendingPositions);
    }
  };

  const handleCancelChanges = () => {
    setLocalSpecialists(null);
    setPendingPositions(null);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Specialist Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage specialist positions and display order for the booking interface
        </p>
      </div>

      {/* Navigation Tabs - Button Group Style */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit border">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")}>
            <Users className="mr-2 h-4 w-4" />
            All Users
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/admin/users/specialists")}
          >
            <Stethoscope className="mr-2 h-4 w-4" />
            Specialists
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, job title, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex gap-4">
          {/* Status Toggle - OriginUI Tabs Style */}
          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
          >
            <TabsList className="bg-background h-auto -space-x-px p-0 shadow-xs rtl:space-x-reverse border">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
              >
                Active
              </TabsTrigger>
              <TabsTrigger
                value="inactive"
                className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
              >
                Inactive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={appointmentTypeFilter}
            onValueChange={(value: "all" | "in_person" | "telehealth" | "on_request") =>
              setAppointmentTypeFilter(value)
            }
          >
            <SelectTrigger className="max-w-[230px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Appointment Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="in_person">
                <div className="flex items-center">
                  <MapPinned className="w-4 h-4 mr-2" />
                  In-person Only
                </div>
              </SelectItem>
              <SelectItem value="telehealth">
                <div className="flex items-center">
                  <Video className="w-4 h-4 mr-2" />
                  Telehealth Only
                </div>
              </SelectItem>
              <SelectItem value="on_request">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  On Request Only
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={locationFilter}
            onValueChange={(value: "all" | "has_location" | "no_location") =>
              setLocationFilter(value)
            }
          >
            <SelectTrigger className="w-[200px]">
              <MapPinned className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Location Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="has_location">Has Location</SelectItem>
              <SelectItem value="no_location">No Location / TBD</SelectItem>
            </SelectContent>
          </Select>

          {(appointmentTypeFilter !== "all" ||
            locationFilter !== "all" ||
            statusFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setAppointmentTypeFilter("all");
                setLocationFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Save/Cancel buttons - only show when positions have changed */}
      {pendingPositions && (
        <div className="flex gap-2 mb-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              You have unsaved changes to specialist positions.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCancelChanges}
            disabled={updatePositionsMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSavePositions} disabled={updatePositionsMutation.isPending}>
            {updatePositionsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Specialist Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading specialists...</p>
        </div>
      ) : filteredSpecialists.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No specialists found</p>
        </div>
      ) : (
        <SortableSpecialistGrid
          specialists={filteredSpecialists}
          onReorder={handleReorder}
          onSpecialistClick={setSelectedSpecialist}
        />
      )}

      {/* Specialist Detail Dialog */}
      {selectedSpecialist && (
        <SpecialistDetailDialog
          specialist={selectedSpecialist}
          open={!!selectedSpecialist}
          onOpenChange={(open) => !open && setSelectedSpecialist(null)}
        />
      )}
    </div>
  );
}
