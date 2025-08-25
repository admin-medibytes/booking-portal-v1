"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { adminClient, specialistsClient } from "@/lib/hono-client";
import { SortableSpecialistGrid } from "./components/SortableSpecialistGrid";
import { SpecialistDetailDialog } from "./components/SpecialistDetailDialog";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  location: string | null;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function AdminSpecialistsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [pendingPositions, setPendingPositions] = useState<Array<{ id: string; position: number }> | null>(null);
  const [localSpecialists, setLocalSpecialists] = useState<Specialist[] | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const queryClient = useQueryClient();

  // Fetch specialists
  const { data: specialists = [], isLoading } = useQuery({
    queryKey: ["admin-specialists", includeInactive],
    queryFn: async () => {
      const response = await adminClient.specialists.$get({
        query: { includeInactive: includeInactive ? "true" : "false" },
      });
      const data = (await response.json()) as { success: boolean; data: Specialist[] };
      return data.data || [];
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
    const filtered = displaySpecialists.filter((specialist) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        specialist.name.toLowerCase().includes(searchLower) ||
        specialist.user.email.toLowerCase().includes(searchLower) ||
        specialist.user.jobTitle.toLowerCase().includes(searchLower) ||
        (specialist.location && specialist.location.toLowerCase().includes(searchLower))
      );
    });
    // Ensure sorted by position
    return filtered.sort((a, b) => a.position - b.position);
  }, [displaySpecialists, searchTerm]);

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

      <Tabs value="specialists" className="mb-6">
        <TabsList>
          <TabsTrigger value="all-users" onClick={() => router.push("/admin/users")}>
            <Users className="mr-2 h-4 w-4" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="specialists" onClick={() => router.push("/admin/users/specialists")}>
            <UserCheck className="mr-2 h-4 w-4" />
            Specialists
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, job title, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
        <Button
          variant={includeInactive ? "default" : "outline"}
          onClick={() => setIncludeInactive(!includeInactive)}
        >
          {includeInactive ? "Show Active Only" : "Show All"}
        </Button>
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
          <Button
            onClick={handleSavePositions}
            disabled={updatePositionsMutation.isPending}
          >
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
