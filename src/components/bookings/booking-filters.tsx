"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { debounce } from "@/lib/debounce";
import type { Specialist } from "@/types/specialist";

interface BookingFiltersProps {
  specialists?: Specialist[];
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  status: "active" | "closed" | null;
  specialistIds: string[];
  search: string;
}

export function BookingFilters({ specialists = [], onFiltersChange }: BookingFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filter state from URL
  const [filters, setFilters] = useState<FilterState>(() => {
    const urlStatus = searchParams.get("status");
    // Convert "all" to null, validate other values
    const status =
      urlStatus === "all" || !urlStatus
        ? null
        : ["active", "closed"].includes(urlStatus)
          ? (urlStatus as "active" | "closed")
          : null;
    const specialistIds = searchParams.get("specialists")?.split(",").filter(Boolean) || [];
    const search = searchParams.get("search") || "";

    return {
      status,
      specialistIds,
      search,
    };
  });

  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newFilters: FilterState) => {
      const params = new URLSearchParams(searchParams.toString());

      // Status filter
      if (newFilters.status) {
        params.set("status", newFilters.status);
      } else {
        params.delete("status");
      }

      // Specialist filter
      if (newFilters.specialistIds.length > 0) {
        params.set("specialists", newFilters.specialistIds.join(","));
      } else {
        params.delete("specialists");
      }

      // Search filter
      if (newFilters.search) {
        params.set("search", newFilters.search);
      } else {
        params.delete("search");
      }

      // Reset to page 1 when filters change
      params.set("page", "1");

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Create a stable debounced function
  const debouncedUpdateSearch = useMemo(
    () =>
      debounce((value: string, currentFilters: FilterState) => {
        const newFilters = { ...currentFilters, search: value };
        setFilters(newFilters);
        updateUrl(newFilters);
        onFiltersChange?.(newFilters);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedUpdateSearch(value, filters);
  };

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    // Convert "all" to null, otherwise keep the value
    const newStatus = value === "all" ? null : (value as "active" | "closed");
    const newFilters = { ...filters, status: newStatus };
    setFilters(newFilters);
    updateUrl(newFilters);
    onFiltersChange?.(newFilters);
  };

  // Handle specialist selection
  const handleSpecialistToggle = (specialistId: string) => {
    const newSpecialistIds = filters.specialistIds.includes(specialistId)
      ? filters.specialistIds.filter((id) => id !== specialistId)
      : [...filters.specialistIds, specialistId];

    const newFilters = { ...filters, specialistIds: newSpecialistIds };
    setFilters(newFilters);
    updateUrl(newFilters);
    onFiltersChange?.(newFilters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const newFilters: FilterState = {
      status: null,
      specialistIds: [],
      search: "",
    };
    setFilters(newFilters);
    setSearchInput("");
    updateUrl(newFilters);
    onFiltersChange?.(newFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = filters.status || filters.specialistIds.length > 0 || filters.search;

  // Get selected specialists' names for display
  const selectedSpecialists = specialists.filter((s) => filters.specialistIds.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[325px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by examinee name, email or phone"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-3 bg-background"
          />
          {searchInput && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <Select value={filters.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px] bg-background hover:bg-accent">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Specialist Multi-Select */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="min-w-[200px] justify-between"
            >
              {selectedSpecialists.length === 0
                ? "Select specialists..."
                : selectedSpecialists.length === 1
                  ? selectedSpecialists[0].name
                  : `${selectedSpecialists.length} specialists`}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search specialists..." />
              <CommandList>
                <CommandEmpty>No specialist found.</CommandEmpty>
                <CommandGroup>
                  {specialists.map((specialist) => (
                    <CommandItem
                      key={specialist.id}
                      value={specialist.name}
                      onSelect={() => handleSpecialistToggle(specialist.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          filters.specialistIds.includes(specialist.id)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{specialist.name}</div>
                        <div className="text-sm text-muted-foreground">{specialist.user?.jobTitle || "Specialist"}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-10">
            Clear filters
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {(selectedSpecialists.length > 0 || filters.status || filters.search) && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="stone" className="capitalize">
              Status: {filters.status}
            </Badge>
          )}
          {filters.search && <Badge variant="stone">Search: {filters.search}</Badge>}
          {selectedSpecialists.map((specialist) => (
            <Badge key={specialist.id} variant="secondary">
              {specialist.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
