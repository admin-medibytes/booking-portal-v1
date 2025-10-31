"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Globe, ChevronDown } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { debounce } from "@/lib/debounce";
import { timeZones } from "@/lib/utils/timezones";
import type { Specialist } from "@/types/specialist";

// Filter for Australian timezones only
const australianTimezones = timeZones.filter((tz) => tz.label.includes("Australia"));

interface BookingFiltersProps {
  specialists?: Specialist[];
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  status: "active" | "closed" | null;
  specialistIds: string[];
  search: string;
  timezone: string;
}

export function BookingFilters({ specialists = [] }: BookingFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filter state from URL
  const [filters, setFilters] = useState<FilterState>(() => {
    const urlStatus = searchParams.get("status") ?? "active";
    // Convert "all" to null, validate other values
    const status =
      urlStatus === "all"
        ? null
        : ["active", "closed"].includes(urlStatus)
          ? (urlStatus as "active" | "closed")
          : "active"; // Default to "active" instead of null
    const specialistIds = searchParams.get("specialists")?.split(",").filter(Boolean) || [];
    const search = searchParams.get("search") || "";
    const timezone = searchParams.get("timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      status,
      specialistIds,
      search,
      timezone,
    };
  });

  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Use ref to store latest filters without causing re-renders
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Initialize URL with default status if not present
  useEffect(() => {
    const currentStatus = searchParams.get("status");
    if (!currentStatus && filters.status === "active") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", "active");
      router.replace(`?${params.toString()}`);
    }
  }, [filters.status, router, searchParams]);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newFilters: FilterState) => {
      const params = new URLSearchParams(searchParams.toString());

      // Status filter
      if (newFilters.status) {
        params.set("status", newFilters.status);
      } else {
        params.set("status", "all"); // Set to "all" when no specific status is selected
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

      // Timezone filter
      if (newFilters.timezone) {
        params.set("timezone", newFilters.timezone);
      } else {
        params.delete("timezone");
      }

      // Reset to page 1 when filters change
      params.set("page", "1");

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Create stable debounced function using ref
  const debouncedSearchRef = useRef(
    debounce((value: string) => {
      const newFilters = { ...filtersRef.current, search: value };
      setFilters(newFilters);
      updateUrl(newFilters);
      // onFiltersChange removed - URL is source of truth
    }, 300)
  );

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    debouncedSearchRef.current(value);
  }, []);

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    // Convert "all" to null, otherwise keep the value
    const newStatus = value === "all" ? null : (value as "active" | "closed");
    const newFilters = { ...filters, status: newStatus };
    setFilters(newFilters);
    updateUrl(newFilters);
    // onFiltersChange removed - URL is source of truth
  };

  // Handle specialist selection
  const handleSpecialistToggle = (specialistId: string) => {
    const newSpecialistIds = filters.specialistIds.includes(specialistId)
      ? filters.specialistIds.filter((id) => id !== specialistId)
      : [...filters.specialistIds, specialistId];

    const newFilters = { ...filters, specialistIds: newSpecialistIds };
    setFilters(newFilters);
    updateUrl(newFilters);
    // onFiltersChange removed - URL is source of truth
  };

  // Handle timezone change
  const handleTimezoneChange = (value: string) => {
    const newFilters = { ...filters, timezone: value };
    setFilters(newFilters);
    updateUrl(newFilters);
    // onFiltersChange removed - URL is source of truth
  };

  // Clear all filters
  const handleClearFilters = () => {
    const newFilters: FilterState = {
      status: "active",
      specialistIds: [],
      search: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    setFilters(newFilters);
    setSearchInput("");
    updateUrl(newFilters);
    // onFiltersChange removed - URL is source of truth
  };

  // Check if any filters are active (different from defaults)
  const hasActiveFilters = filters.status !== "active" || filters.specialistIds.length > 0 || filters.search;

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
            placeholder="Search by examinee name"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              handleSearchChange(e.target.value);
            }}
            className="pl-9 pr-3 bg-background"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                handleSearchChange("");
              }}
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
            <SelectItem value="closed">Cancelled</SelectItem>
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
                        <div className="text-sm text-muted-foreground">
                          {specialist.user?.jobTitle || "Specialist"}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Timezone Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-sm">
                {timeZones.find((tz) => tz.tzCode === filters.timezone)?.tzCode || filters.timezone}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2" align="end">
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {australianTimezones.map((tz) => (
                  <div
                    key={tz.tzCode}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                      filters.timezone === tz.tzCode && "bg-accent"
                    )}
                    onClick={() => handleTimezoneChange(tz.tzCode)}
                  >
                    <span>{tz.label}</span>
                    {filters.timezone === tz.tzCode && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
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
            <Badge variant="secondary" className="capitalize">
              Status: {filters.status}
            </Badge>
          )}
          {filters.search && <Badge variant="secondary">Search: {filters.search}</Badge>}
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
