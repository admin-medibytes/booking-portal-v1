"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  FileText,
  ClipboardList,
  Wrench,
  RefreshCw,
  Clock,
  Link2,
  Search,
  Settings2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentTypesSyncModal } from "./components/AppointmentTypesSyncModal";
import { FormsSyncModal } from "./components/FormsSyncModal";
import { FormManagementModal } from "./components/FormManagementModal";
import { AppFormModal } from "./components/AppFormModal";
import { toast } from "sonner";
import { adminClient } from "@/lib/hono-client";

interface AppointmentType {
  id: number;
  name: string;
  duration: number;
  price?: string | null;
  category: string;
  active: boolean;
  lastSyncedAt: string;
  isLinked?: boolean;
  formCount?: number;
}

interface AcuityForm {
  id: number;
  name: string;
  description: string;
  hidden: boolean;
  appointmentTypeCount?: number;
  fieldCount?: number;
  lastSyncedAt: string;
  hasAppForm?: boolean;
  appFormId?: string;
}

interface AcuityFormField {
  id: number;
  name: string;
  required?: boolean;
  type: "textbox" | "textarea" | "dropdown" | "checkbox" | "checkboxlist" | "yesno" | "file";
  options?: string[];
}

interface AcuityFormFromAPI {
  id: number;
  name: string;
  description?: string;
  hidden?: boolean;
  appointmentTypeIDs?: number[];
  fields?: AcuityFormField[];
}

interface FormsSyncData {
  acuityForms: AcuityFormFromAPI[];
  newForms: AcuityFormFromAPI[];
  updatedForms: AcuityFormFromAPI[];
}

interface FormsComparisonResult extends FormsSyncData {
  existingForms: AcuityFormFromAPI[];
}

export default function AcuityIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the current view from query params, default to 'calendar'
  const currentView = searchParams.get("view") || "calendar";

  // State for appointment types
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<AppointmentType | null>(
    null
  );
  const [isFormManagementModalOpen, setIsFormManagementModalOpen] = useState(false);

  // State for forms
  const [forms, setForms] = useState<AcuityForm[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [isFormsSyncModalOpen, setIsFormsSyncModalOpen] = useState(false);
  const [formsSearchQuery, setFormsSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState<AcuityForm | null>(null);
  const [isAppFormModalOpen, setIsAppFormModalOpen] = useState(false);

  // Filter states for appointment types
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Compute unique categories from appointment types
  const uniqueCategories = useMemo(() => {
    const categories = new Set(appointmentTypes.map((type) => type.category || "Uncategorized"));
    return Array.from(categories).sort();
  }, [appointmentTypes]);

  // Filter appointment types based on search and category
  const filteredAppointmentTypes = useMemo(() => {
    return appointmentTypes.filter((type) => {
      // Filter by search query
      const matchesSearch =
        searchQuery === "" || type.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter by category
      const matchesCategory =
        selectedCategory === "all" || (type.category || "Uncategorized") === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [appointmentTypes, searchQuery, selectedCategory]);

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    router.push(`/admin/integrations/acuity?${params.toString()}`);
  };

  // Fetch appointment types from database
  const fetchAppointmentTypes = async () => {
    setIsLoading(true);
    try {
      const response = await adminClient.integration.acuity["appointment-types"].$get();

      if (!response.ok) {
        throw new Error("Failed to fetch appointment types");
      }

      const data = await response.json();
      if ("success" in data && data.success) {
        setAppointmentTypes(data.data || []);
      } else {
        throw new Error((data as any).error || "Failed to fetch appointment types");
      }
    } catch (error) {
      toast.error("Failed to fetch appointment types");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sync confirmation
  const handleConfirmSync = async (comparisonData: any) => {
    const response = await adminClient.integration.acuity["appointment-types"].sync.$post({
      json: comparisonData,
    });

    if (!response.ok) {
      throw new Error("Sync failed");
    }

    const result = await response.json();

    if ("success" in result && result.success) {
      toast.success(`Synced ${result.synced} appointment types`);
    } else {
      throw new Error((result as any).error || "Sync failed");
    }

    // Refresh the list
    fetchAppointmentTypes();
  };

  // Fetch forms from database
  const fetchForms = async () => {
    setIsLoadingForms(true);
    try {
      const response = await adminClient.integration.acuity.forms.$get();

      if (!response.ok) {
        throw new Error("Failed to fetch forms");
      }

      const data = await response.json();
      if ("success" in data && data.success) {
        const forms = data.data || [];

        // Check app form status for each form
        const formsWithAppStatus = await Promise.all(
          forms.map(async (form) => {
            try {
              const appFormResponse = await adminClient["app-forms"].check[":acuityFormId"].$get({
                param: { acuityFormId: form.id.toString() },
              });

              if (appFormResponse.ok) {
                const appFormData = await appFormResponse.json();
                if (appFormData.success) {
                  return {
                    ...form,
                    hasAppForm: appFormData.exists,
                    appFormId: appFormData.data?.id,
                  };
                }
              }
            } catch (err) {
              // If checking fails, just return the form without app status
            }
            return form;
          })
        );

        setForms(formsWithAppStatus);
      } else {
        throw new Error((data as any).error || "Failed to fetch forms");
      }
    } catch (error) {
      toast.error("Failed to fetch forms");
    } finally {
      setIsLoadingForms(false);
    }
  };

  // Handle forms sync confirmation
  const handleConfirmFormsSync = async (comparisonData: FormsComparisonResult) => {
    // Extract only the fields needed for sync
    const syncData: FormsSyncData = {
      acuityForms: comparisonData.acuityForms,
      newForms: comparisonData.newForms,
      updatedForms: comparisonData.updatedForms,
    };

    const response = await adminClient.integration.acuity.forms.sync.$post({
      json: syncData,
    });

    if (!response.ok) {
      throw new Error("Sync failed");
    }

    const result = await response.json();

    if ("success" in result && result.success) {
      toast.success(`Synced ${result.synced} forms`);
    } else {
      throw new Error((result as any).error || "Sync failed");
    }

    // Refresh the list
    fetchForms();
  };

  // Filter forms based on search
  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      const matchesSearch =
        formsSearchQuery === "" ||
        form.name.toLowerCase().includes(formsSearchQuery.toLowerCase()) ||
        form.description.toLowerCase().includes(formsSearchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [forms, formsSearchQuery]);

  // Fetch appointment types when view changes to appointment-types
  useEffect(() => {
    if (currentView === "appointment-types") {
      fetchAppointmentTypes();
    } else if (currentView === "forms") {
      fetchForms();
    }
  }, [currentView]);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Acuity Scheduling Integration</h1>
        <p className="text-muted-foreground mt-2">
          Connect and sync your Acuity Scheduling account with the booking portal
        </p>
      </div>

      <div className="mb-6">
        <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit border">
          <Button
            variant={currentView === "calendar" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("calendar")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </Button>
          <Button
            variant={currentView === "appointment-types" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("appointment-types")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Appointment Types
          </Button>
          <Button
            variant={currentView === "forms" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("forms")}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Forms
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {currentView === "calendar" && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Wrench className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-lg text-muted-foreground">In Development</p>
            </div>
          </div>
        )}

        {currentView === "appointment-types" && (
          <div className="space-y-4">
            {/* Appointment Types List */}
            {isLoading ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : appointmentTypes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Appointment Types</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Sync appointment types from Acuity to get started
                  </p>
                  <Button onClick={() => setIsSyncModalOpen(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync from Acuity
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex flex-col h-[calc(100vh-300px)]">
                <CardHeader className="flex-shrink-0">
                  <div className="flex flex-col">
                    <CardTitle className="flex items-center justify-between">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 w-[350px]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {uniqueCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={() => setIsSyncModalOpen(true)} disabled={isLoading}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync from Acuity
                        </Button>
                      </div>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <div className="h-full overflow-y-auto border-y">
                    <div className="divide-y">
                      {filteredAppointmentTypes.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          {searchQuery || selectedCategory !== "all"
                            ? "No appointment types match your filters"
                            : "No appointment types found"}
                        </div>
                      ) : (
                        filteredAppointmentTypes.map((type) => (
                          <div key={type.id} className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-6">
                              {/* Left Section - Core Data */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm">{type.name}</h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>{type.category || "Uncategorized"}</span>
                                  <span>•</span>
                                  <span>{type.duration} min</span>
                                  {type.price && type.price !== null && (
                                    <>
                                      <span>•</span>
                                      <span>${type.price}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Visual Separator */}
                              <div className="w-px bg-border h-10 self-center" />

                              {/* Right Section - Relationships & Meta */}
                              <div className="flex items-center gap-3 shrink-0">
                                {/* Forms Button (clickable badge) */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs font-medium"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppointmentType(type);
                                    setIsFormManagementModalOpen(true);
                                  }}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  {type.formCount && type.formCount > 0
                                    ? `${type.formCount} ${type.formCount === 1 ? "form" : "forms"}`
                                    : "No forms"}
                                </Button>

                                {/* Specialist Link Badge */}
                                {type.isLinked ? (
                                  <Badge variant="success" className="shrink-0">
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Specialist
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-muted-foreground"
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    No specialist
                                  </Badge>
                                )}

                                {/* Last Synced */}
                                <div className="text-right pl-3 border-l">
                                  <div className="text-xs text-muted-foreground">Synced</div>
                                  <div className="text-xs font-medium">
                                    {new Date(type.lastSyncedAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync Modal */}
            <AppointmentTypesSyncModal
              open={isSyncModalOpen}
              onClose={() => setIsSyncModalOpen(false)}
              onSync={fetchAppointmentTypes}
              onConfirmSync={handleConfirmSync}
            />
          </div>
        )}

        {currentView === "forms" && (
          <div className="space-y-4">
            {/* Forms Header with Search and Sync */}
            <div className="flex items-center justify-between">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search forms..."
                  value={formsSearchQuery}
                  onChange={(e) => setFormsSearchQuery(e.target.value)}
                  className="pl-8 w-[350px]"
                />
              </div>
              <Button onClick={() => setIsFormsSyncModalOpen(true)} disabled={isLoadingForms}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync from Acuity
              </Button>
            </div>

            {/* Forms Grid */}
            {isLoadingForms ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-full mt-2" />
                      <Skeleton className="h-3 w-5/6" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <Skeleton className="h-3 w-32 mt-3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredForms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Forms Found</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {formsSearchQuery
                      ? "No forms match your search"
                      : "Sync forms from Acuity to get started"}
                  </p>
                  {!formsSearchQuery && (
                    <Button onClick={() => setIsFormsSyncModalOpen(true)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync from Acuity
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredForms.map((form) => (
                  <Card key={form.id} className="flex flex-col relative">
                    {form.hasAppForm && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge variant="success" className="text-xs">
                          <Settings2 className="w-3 h-3 mr-1" />
                          Customized
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-2 pr-20">{form.name}</CardTitle>
                        {form.hidden && (
                          <Badge variant="secondary" className="shrink-0">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      {form.description && (
                        <CardDescription className="line-clamp-2 mt-2">
                          {form.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {form.appointmentTypeCount && form.appointmentTypeCount > 0 ? (
                            <Badge variant="default">
                              <Calendar className="w-3 h-3 mr-1" />
                              {form.appointmentTypeCount}{" "}
                              {form.appointmentTypeCount === 1 ? "type" : "types"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Calendar className="w-3 h-3 mr-1" />
                              No appt. types
                            </Badge>
                          )}
                          {form.fieldCount && form.fieldCount > 0 ? (
                            <Badge variant="secondary">
                              <FileText className="w-3 h-3 mr-1" />
                              {form.fieldCount} {form.fieldCount === 1 ? "field" : "fields"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <FileText className="w-3 h-3 mr-1" />
                              No fields
                            </Badge>
                          )}
                        </div>

                        <Button
                          variant={form.hasAppForm ? "outline" : "default"}
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            // Open app form modal
                            setSelectedForm(form);
                            setIsAppFormModalOpen(true);
                          }}
                        >
                          {form.hasAppForm ? (
                            <>
                              <Settings2 className="w-3 h-3 mr-2" />
                              Edit Customization
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 mr-2" />
                              Create App Form
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-3">
                        <Clock className="w-3 h-3" />
                        Last synced: {new Date(form.lastSyncedAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Forms Sync Modal */}
            <FormsSyncModal
              open={isFormsSyncModalOpen}
              onClose={() => setIsFormsSyncModalOpen(false)}
              onSync={fetchForms}
              onConfirmSync={handleConfirmFormsSync}
            />
          </div>
        )}
      </div>

      {/* Form Management Modal */}
      <FormManagementModal
        open={isFormManagementModalOpen}
        onClose={() => {
          setIsFormManagementModalOpen(false);
          setSelectedAppointmentType(null);
        }}
        appointmentType={selectedAppointmentType}
        onUpdate={fetchAppointmentTypes}
      />

      {/* App Form Modal */}
      <AppFormModal
        open={isAppFormModalOpen}
        onClose={() => {
          setIsAppFormModalOpen(false);
          setSelectedForm(null);
        }}
        form={selectedForm}
        onSuccess={fetchForms}
      />
    </div>
  );
}
