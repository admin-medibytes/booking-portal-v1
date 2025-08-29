"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { specialistsClient } from "@/lib/hono-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  RefreshCcw,
  Edit2,
  Save,
  Clock,
  AlertCircle,
  Info,
  Filter,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AppointmentType {
  id: string;
  acuityAppointmentTypeId: number;
  acuityName: string;
  acuityDescription: string | null;
  name: string;
  description: string | null;
  duration: number;
  category: string | null;
  source: {
    name: "override" | "acuity";
    description: "override" | "acuity";
  };
  enabled: boolean;
  customDisplayName: string | null;
  customDescription: string | null;
  customPrice: number | null;
  notes: string | null;
}

interface AppointmentTypesManagementProps {
  specialistId: string;
}

export function AppointmentTypesManagement({
  specialistId,
}: AppointmentTypesManagementProps) {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingItems, setEditingItems] = useState<Record<string, any>>({});
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Fetch appointment types (for admin, we need all types, not just enabled)
  const { data: appointmentData, isLoading, refetch } = useQuery({
    queryKey: ["admin-appointment-types", specialistId],
    queryFn: async () => {
      // Get all appointment types with specialist mappings for admin
      const response = await specialistsClient[":id"]["appointment-types"].admin.$get({
        param: { id: specialistId },
      });
      if (!response.ok) throw new Error("Failed to fetch appointment types");
      const data = await response.json();
      return data;
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await specialistsClient[":id"]["appointment-types"].sync.$post({
        param: { id: specialistId },
        json: { strategy: "auto-enable-by-category" },
      });
      if (!response.ok) throw new Error("Failed to sync appointment types");
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} appointment types`);
      setLastSyncedAt(data.lastSyncedAt);
      refetch();
    },
    onError: () => {
      toast.error("Failed to sync appointment types");
    },
  });

  // Bulk update mutation
  const updateMutation = useMutation({
    mutationFn: async (items: Array<{
      appointmentTypeId: string;
      enabled?: boolean;
      customDisplayName?: string | null;
      customDescription?: string | null;
    }>) => {
      const response = await specialistsClient[":id"]["appointment-types"].$put({
        param: { id: specialistId },
        json: { items },
      });
      if (!response.ok) throw new Error("Failed to update appointment types");
      return response.json();
    },
    onMutate: async (items) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["admin-appointment-types", specialistId] });
      const previousData = queryClient.getQueryData(["admin-appointment-types", specialistId]);
      
      queryClient.setQueryData(["admin-appointment-types", specialistId], (old: any) => {
        if (!old?.data) return old;
        const updatedData = old.data.map((type: AppointmentType) => {
          const update = items.find(item => item.appointmentTypeId === type.id);
          if (update) {
            return {
              ...type,
              ...update,
              name: update.customDisplayName || type.name,
              description: update.customDescription !== undefined ? update.customDescription : type.description,
              source: {
                name: update.customDisplayName ? "override" : "acuity",
                description: update.customDescription !== undefined ? "override" : "acuity",
              },
            };
          }
          return type;
        });
        return { ...old, data: updatedData };
      });
      
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["admin-appointment-types", specialistId], context.previousData);
      }
      toast.error("Failed to update appointment types");
    },
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} appointment types`);
      setPendingChanges(new Map());
      setEditingItems({});
      refetch();
    },
  });

  interface ApiAppointmentType {
    id: string;
    acuityAppointmentTypeId: number;
    acuityName: string;
    acuityDescription: string | null;
    name: string;
    description: string | null;
    duration: number;
    category: string | null;
    enabled: boolean;
    customDisplayName: string | null;
    customDescription: string | null;
    customPrice: number | null;
    notes: string | null;
    source: {
      name: string;
      description: string;
    };
  }

  const appointmentTypes: AppointmentType[] = (appointmentData?.data || []).map((type: ApiAppointmentType) => ({
    ...type,
    source: {
      name: type.source?.name as "override" | "acuity",
      description: type.source?.description as "override" | "acuity",
    },
  }));

  // Get unique categories
  const categories = Array.from(
    new Set(appointmentTypes.map((type: AppointmentType) => type.category).filter(Boolean))
  );

  // Filter appointment types by category
  const filteredTypes = categoryFilter === "all" 
    ? appointmentTypes 
    : appointmentTypes.filter((type: AppointmentType) => type.category === categoryFilter);

  const handleToggleEnabled = (typeId: string, enabled: boolean) => {
    const newChanges = new Map(pendingChanges);
    const existing = newChanges.get(typeId) || {};
    newChanges.set(typeId, { ...existing, appointmentTypeId: typeId, enabled });
    setPendingChanges(newChanges);
  };

  const handleEditOverride = (type: AppointmentType) => {
    setSelectedType(type);
    setEditingItems({
      customDisplayName: type.customDisplayName || "",
      customDescription: type.customDescription || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveOverride = () => {
    if (!selectedType) return;
    
    const newChanges = new Map(pendingChanges);
    const existing = newChanges.get(selectedType.id) || {};
    newChanges.set(selectedType.id, {
      ...existing,
      appointmentTypeId: selectedType.id,
      customDisplayName: editingItems.customDisplayName || null,
      customDescription: editingItems.customDescription || null,
    });
    setPendingChanges(newChanges);
    setIsEditDialogOpen(false);
    setSelectedType(null);
    setEditingItems({});
  };

  const handleApplyChanges = () => {
    const items = Array.from(pendingChanges.values());
    if (items.length > 0) {
      updateMutation.mutate(items);
    }
  };

  const handleBulkToggle = (enable: boolean) => {
    const newChanges = new Map(pendingChanges);
    filteredTypes.forEach((type: AppointmentType) => {
      const existing = newChanges.get(type.id) || {};
      newChanges.set(type.id, {
        ...existing,
        appointmentTypeId: type.id,
        enabled: enable,
      });
    });
    setPendingChanges(newChanges);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Appointment Types</CardTitle>
              <CardDescription>
                Manage which appointment types this specialist offers
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lastSyncedAt && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Sync from Acuity
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and bulk actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category || "uncategorized"} value={category || "uncategorized"}>
                      {category || "Uncategorized"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(true)}
              >
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(false)}
              >
                Disable All
              </Button>
            </div>
          </div>

          {/* Pending changes alert */}
          {pendingChanges.size > 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>You have {pendingChanges.size} unsaved changes</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingChanges(new Map())}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyChanges}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Apply Changes
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Appointment types table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {categoryFilter === "all" 
                  ? "No appointment types found. Click 'Sync from Acuity' to import."
                  : "No appointment types found in this category."}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Enabled</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTypes.map((type: AppointmentType) => {
                    const hasChanges = pendingChanges.has(type.id);
                    const pendingChange = pendingChanges.get(type.id);
                    const isEnabled = pendingChange?.enabled !== undefined 
                      ? pendingChange.enabled 
                      : type.enabled;

                    return (
                      <TableRow key={type.id} className={hasChanges ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleEnabled(type.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {pendingChange?.customDisplayName || type.name}
                              </span>
                              {(type.source.name === "override" || pendingChange?.customDisplayName) && (
                                <Badge variant="outline" className="text-xs">
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Override
                                </Badge>
                              )}
                            </div>
                            {type.source.name === "override" && (
                              <p className="text-xs text-muted-foreground">
                                Original: {type.acuityName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDuration(type.duration)}</TableCell>
                        <TableCell>
                          {type.category && (
                            <Badge variant="secondary">{type.category}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="space-y-1">
                            <p className="text-sm truncate">
                              {pendingChange?.customDescription !== undefined 
                                ? (pendingChange.customDescription || "—")
                                : (type.description || "—")}
                            </p>
                            {(type.source.description === "override" || pendingChange?.customDescription !== undefined) && (
                              <Badge variant="outline" className="text-xs">
                                <Edit2 className="w-3 h-3 mr-1" />
                                Override
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOverride(type)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Override Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Appointment Type Override</DialogTitle>
            <DialogDescription>
              Customize how this appointment type appears for this specialist. Leave fields empty to use Acuity defaults.
            </DialogDescription>
          </DialogHeader>
          {selectedType && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={editingItems.customDisplayName || ""}
                  onChange={(e) => setEditingItems({ ...editingItems, customDisplayName: e.target.value })}
                  placeholder={selectedType.acuityName}
                />
                <p className="text-xs text-muted-foreground">
                  Acuity default: {selectedType.acuityName}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingItems.customDescription || ""}
                  onChange={(e) => setEditingItems({ ...editingItems, customDescription: e.target.value })}
                  placeholder={selectedType.acuityDescription || "No description"}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Acuity default: {selectedType.acuityDescription || "No description"}
                </p>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  These overrides only affect how this appointment type is displayed for this specialist. The original Acuity values are preserved.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOverride}>
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}