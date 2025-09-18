"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, DollarSign, AlertCircle, Search, CheckCircle2, CalendarDays, Video, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { adminClient } from "@/lib/hono-client";
import { cn } from "@/lib/utils";

interface AppointmentType {
  id: number;
  name: string;
  description?: string;
  duration: number;
  price: string | number | null;
  active: boolean;
  category?: string | null;
}

interface AppointmentTypesModalProps {
  open: boolean;
  onClose: () => void;
  specialistId: string;
  specialistName: string;
  onSuccess?: () => void;
}

export function AppointmentTypesModal({
  open,
  onClose,
  specialistId,
  specialistName,
  onSuccess,
}: AppointmentTypesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set());
  const [appointmentModes, setAppointmentModes] = useState<Map<number, "in-person" | "telehealth">>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch all appointment types and current specialist selections
  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      // Reset state when modal closes
      setSearchQuery("");
      setError(null);
    }
  }, [open, specialistId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all appointment types
      const typesResponse = await adminClient.integration.acuity["appointment-types"].$get();

      if (!typesResponse.ok) {
        throw new Error("Failed to fetch appointment types");
      }

      const typesData = await typesResponse.json();

      // Fetch current specialist appointment types
      const specialistTypesResponse = await adminClient.specialists[":id"][
        "appointment-types"
      ].$get({
        param: { id: specialistId },
      });

      if (specialistTypesResponse.ok) {
        const specialistData = await specialistTypesResponse.json();
        // Set selected types and modes based on current associations
        const selected = new Set<number>();
        const modes = new Map<number, "in-person" | "telehealth">();
        
        specialistData.data?.forEach((item: any) => {
          selected.add(item.appointmentTypeId);
          modes.set(item.appointmentTypeId, item.appointmentMode || "telehealth");
        });
        
        setSelectedTypes(selected);
        setAppointmentModes(modes);
      }

      setAppointmentTypes(typesData.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load appointment types");
      toast.error("Failed to load appointment types");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (typeId: number) => {
    const newSelected = new Set(selectedTypes);
    const newModes = new Map(appointmentModes);
    
    if (newSelected.has(typeId)) {
      newSelected.delete(typeId);
      newModes.delete(typeId);
    } else {
      newSelected.add(typeId);
      // Default to telehealth when first selected
      newModes.set(typeId, "telehealth");
    }
    
    setSelectedTypes(newSelected);
    setAppointmentModes(newModes);
  };
  
  const handleModeToggle = (typeId: number, isInPerson: boolean) => {
    const newModes = new Map(appointmentModes);
    newModes.set(typeId, isInPerson ? "in-person" : "telehealth");
    setAppointmentModes(newModes);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build appointment types array with modes
      const appointmentTypesData = Array.from(selectedTypes).map(typeId => ({
        id: typeId,
        mode: appointmentModes.get(typeId) || "telehealth",
      }));

      const response = await adminClient.specialists[":id"]["appointment-types"].$put({
        param: { id: specialistId },
        json: {
          appointmentTypes: appointmentTypesData,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error((error as any).error || "Failed to save appointment types");
      }

      toast.success("Appointment types updated successfully");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Error saving appointment types:", err);
      setError(err.message || "Failed to save appointment types");
      toast.error(err.message || "Failed to save appointment types");
    } finally {
      setSaving(false);
    }
  };

  // Filter appointment types based on search
  const filteredTypes = appointmentTypes.filter((type) => {
    const query = searchQuery.toLowerCase();
    return (
      type.name.toLowerCase().includes(query) ||
      type.description?.toLowerCase().includes(query) ||
      type.category?.toLowerCase().includes(query)
    );
  });

  // Group types by category
  const groupedTypes = filteredTypes.reduce(
    (acc, type) => {
      const category = type.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(type);
      return acc;
    },
    {} as Record<string, AppointmentType[]>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:max-w-2xl px-0">
        <DialogHeader className="px-6">
          <DialogTitle>Manage Appointment Types</DialogTitle>
          <DialogDescription>
            Select appointment types available for {specialistName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 px-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading appointment types...</p>
            </div>
          ) : error ? (
            <div className="px-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="px-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search appointment types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-6">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Available</p>
                  <p className="text-xl font-semibold">{appointmentTypes.length}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-700">Selected</p>
                  <p className="text-xl font-semibold text-green-700">{selectedTypes.size}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">Active</p>
                  <p className="text-xl font-semibold text-blue-700">
                    {appointmentTypes.filter(t => t.active).length}
                  </p>
                </div>
              </div>

              {/* Appointment Types List */}
              <ScrollArea className="h-[60dvh] border-y">
                <div className="p-4 space-y-2">
                  {filteredTypes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No appointment types found
                    </div>
                  ) : (
                    filteredTypes.map((type) => {
                      const isSelected = selectedTypes.has(type.id);
                      
                      return (
                        <div
                          key={type.id}
                          className={cn(
                            "flex flex-col gap-3 p-3 rounded-lg border",
                            isSelected ? "bg-green-50/50" : "bg-background"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Checkbox
                                id={`type-${type.id}`}
                                checked={isSelected}
                                onCheckedChange={() => handleToggle(type.id)}
                                disabled={!type.active}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`type-${type.id}`}
                                  className="font-medium cursor-pointer"
                                >
                                  {type.name}
                                </label>
                                {type.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {type.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {type.duration} min
                                  </Badge>
                                  {type.price && (
                                    <Badge variant="outline" className="text-xs">
                                      <DollarSign className="w-3 h-3 mr-1" />
                                      {typeof type.price === "number"
                                        ? type.price.toFixed(2)
                                        : type.price}
                                    </Badge>
                                  )}
                                  {type.category && (
                                    <Badge variant="secondary" className="text-xs">
                                      {type.category}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {!type.active ? (
                              <Badge variant="secondary">Inactive</Badge>
                            ) : isSelected ? (
                              <Badge variant="success">Selected</Badge>
                            ) : (
                              <Badge variant="outline">Available</Badge>
                            )}
                          </div>
                          
                          {/* Appointment Mode Selector - Only show when selected */}
                          {isSelected && type.active && (
                            <div className="pl-7 pr-2">
                              <div className="bg-muted/50 inline-flex h-9 rounded-md p-0.5 w-full">
                                <RadioGroup
                                  value={appointmentModes.get(type.id) || "telehealth"}
                                  onValueChange={(value) => handleModeToggle(type.id, value === "in-person")}
                                  className="group after:bg-background has-focus-visible:after:border-ring has-focus-visible:after:ring-ring/50 relative inline-grid grid-cols-2 items-center gap-0 text-sm font-medium after:absolute after:inset-y-0 after:w-1/2 after:rounded-sm after:shadow-xs after:transition-[translate,box-shadow] after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] has-focus-visible:after:ring-[3px] data-[state=telehealth]:after:translate-x-0 data-[state=in-person]:after:translate-x-full w-full"
                                  data-state={appointmentModes.get(type.id) || "telehealth"}
                                >
                                  <Label className="group-data-[state=in-person]:text-muted-foreground/70 relative z-10 inline-flex h-full cursor-pointer items-center justify-center px-3 whitespace-nowrap transition-colors select-none">
                                    <Video className="w-4 h-4 mr-2" />
                                    Telehealth
                                    <RadioGroupItem value="telehealth" className="sr-only" />
                                  </Label>
                                  <Label className="group-data-[state=telehealth]:text-muted-foreground/70 relative z-10 inline-flex h-full cursor-pointer items-center justify-center px-3 whitespace-nowrap transition-colors select-none">
                                    <MapPin className="w-4 h-4 mr-2" />
                                    In-Person
                                    <RadioGroupItem value="in-person" className="sr-only" />
                                  </Label>
                                </RadioGroup>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="px-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
