"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Edit2, 
  Save, 
  X, 
  Clock, 
  DollarSign, 
  Video, 
  MapPin,
  StickyNote,
  Loader2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { specialistsClient } from "@/lib/hono-client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppointmentTypeData {
  specialistId: string;
  appointmentTypeId: number;
  enabled: boolean;
  appointmentMode: "in-person" | "telehealth";
  customDisplayName?: string | null;
  customDescription?: string | null;
  customPrice?: number | null;
  notes?: string | null;
  appointmentType?: {
    id: number;
    name: string;
    description?: string | null;
    duration: number;
    price?: number | null;
    category?: string | null;
    active: boolean;
  };
}

interface EditableAppointmentTypeCardProps {
  data: AppointmentTypeData;
  onUpdate: () => void;
}

export function EditableAppointmentTypeCard({ 
  data, 
  onUpdate 
}: EditableAppointmentTypeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    enabled: data.enabled,
    appointmentMode: data.appointmentMode,
    customDisplayName: data.customDisplayName || "",
    customDescription: data.customDescription || "",
    customPrice: data.customPrice?.toString() || "",
    notes: data.notes || "",
  });

  const hasCustomizations = !!(
    data.customDisplayName || 
    data.customDescription || 
    data.customPrice !== null ||
    data.notes
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await specialistsClient[":id"]["appointment-types"][":typeId"].$put({
        param: { 
          id: data.specialistId, 
          typeId: data.appointmentTypeId.toString() 
        },
        json: {
          enabled: formData.enabled,
          appointmentMode: formData.appointmentMode,
          customDisplayName: formData.customDisplayName || null,
          customDescription: formData.customDescription || null,
          customPrice: formData.customPrice ? parseFloat(formData.customPrice) : null,
          notes: formData.notes || null,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to update appointment type");
      }

      toast.success("Appointment type updated successfully");
      setIsEditing(false);
      onUpdate(); // Refresh the list
    } catch (error) {
      console.error("Error updating appointment type:", error);
      toast.error("Failed to update appointment type");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      enabled: data.enabled,
      appointmentMode: data.appointmentMode,
      customDisplayName: data.customDisplayName || "",
      customDescription: data.customDescription || "",
      customPrice: data.customPrice?.toString() || "",
      notes: data.notes || "",
    });
    setIsEditing(false);
  };

  const handleQuickToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const response = await specialistsClient[":id"]["appointment-types"][":typeId"].$put({
        param: { 
          id: data.specialistId, 
          typeId: data.appointmentTypeId.toString() 
        },
        json: { enabled },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle appointment type");
      }

      toast.success(enabled ? "Appointment type enabled" : "Appointment type disabled");
      onUpdate();
    } catch (error) {
      console.error("Error toggling appointment type:", error);
      toast.error("Failed to toggle appointment type");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <Card className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                {data.customDisplayName || data.appointmentType?.name || "Unknown"}
                {hasCustomizations && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs">
                          Customized
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        This appointment type has custom settings
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </h4>
              <Badge
                variant={data.enabled ? "default" : "secondary"}
                className="text-xs"
              >
                {data.enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {data.appointmentMode === "in-person" ? (
                  <>
                    <MapPin className="w-3 h-3 mr-1" />
                    In-Person
                  </>
                ) : (
                  <>
                    <Video className="w-3 h-3 mr-1" />
                    Telehealth
                  </>
                )}
              </Badge>
            </div>
            
            {(data.customDescription || data.appointmentType?.description) && (
              <p className="text-xs text-muted-foreground mt-1">
                {data.customDescription || data.appointmentType?.description}
              </p>
            )}
            
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {data.appointmentType?.duration || 0} min
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${(data.customPrice ?? data.appointmentType?.price ?? 0).toFixed(2)}
                {data.customPrice !== null && data.appointmentType?.price !== data.customPrice && (
                  <span className="text-muted-foreground/60 line-through ml-1">
                    ${(data.appointmentType?.price ?? 0).toFixed(2)}
                  </span>
                )}
              </span>
              {data.appointmentType?.category && (
                <Badge variant="secondary" className="text-xs">
                  {data.appointmentType.category}
                </Badge>
              )}
            </div>
            
            {data.notes && (
              <div className="flex items-start gap-1 mt-2">
                <StickyNote className="w-3 h-3 text-muted-foreground mt-0.5" />
                <p className="text-xs text-muted-foreground">{data.notes}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={data.enabled}
              onCheckedChange={handleQuickToggle}
              disabled={isSaving}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">
            Edit {data.appointmentType?.name || "Appointment Type"}
          </h4>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="enabled">Status</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, enabled: checked })
              }
            />
            <span className="text-sm">
              {formData.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Appointment Mode */}
        <div className="space-y-2">
          <Label>Appointment Mode</Label>
          <div className="bg-muted/50 inline-flex h-9 rounded-md p-0.5 w-full">
            <RadioGroup
              value={formData.appointmentMode}
              onValueChange={(value) => 
                setFormData({ ...formData, appointmentMode: value as "in-person" | "telehealth" })
              }
              className="group after:bg-background has-focus-visible:after:border-ring has-focus-visible:after:ring-ring/50 relative inline-grid grid-cols-2 items-center gap-0 text-sm font-medium after:absolute after:inset-y-0 after:w-1/2 after:rounded-sm after:shadow-xs after:transition-[translate,box-shadow] after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] has-focus-visible:after:ring-[3px] data-[state=telehealth]:after:translate-x-0 data-[state=in-person]:after:translate-x-full w-full"
              data-state={formData.appointmentMode}
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

        {/* Custom Display Name */}
        <div className="space-y-2">
          <Label htmlFor="customDisplayName" className="flex items-center gap-2">
            Custom Display Name
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Override the default name. Leave empty to use default.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            id="customDisplayName"
            value={formData.customDisplayName}
            onChange={(e) => 
              setFormData({ ...formData, customDisplayName: e.target.value })
            }
            placeholder={data.appointmentType?.name || "Enter custom name"}
          />
        </div>

        {/* Custom Description */}
        <div className="space-y-2">
          <Label htmlFor="customDescription" className="flex items-center gap-2">
            Custom Description
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Override the default description. Leave empty to use default.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Textarea
            id="customDescription"
            value={formData.customDescription}
            onChange={(e) => 
              setFormData({ ...formData, customDescription: e.target.value })
            }
            placeholder={data.appointmentType?.description || "Enter custom description"}
            rows={2}
          />
        </div>

        {/* Custom Price */}
        <div className="space-y-2">
          <Label htmlFor="customPrice" className="flex items-center gap-2">
            Custom Price
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Override the default price. Leave empty to use default (${(data.appointmentType?.price ?? 0).toFixed(2)}).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="customPrice"
              type="number"
              step="0.01"
              value={formData.customPrice}
              onChange={(e) => 
                setFormData({ ...formData, customPrice: e.target.value })
              }
              placeholder={(data.appointmentType?.price ?? 0).toFixed(2)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="flex items-center gap-2">
            Internal Notes
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  These notes are only visible to administrators.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => 
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any internal notes about this appointment type..."
            rows={2}
          />
        </div>
      </div>
    </Card>
  );
}