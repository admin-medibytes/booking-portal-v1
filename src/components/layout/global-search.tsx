"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Users, Building2, Users2, Calendar, FileText, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Mock data for search
const searchData = {
  users: [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      organization: "Acme Corp",
      type: "user",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      organization: "Tech Solutions",
      type: "user",
    },
    {
      id: "3",
      name: "Alice Brown",
      email: "alice@example.com",
      organization: "Design Studio",
      type: "user",
    },
    {
      id: "4",
      name: "Bob Johnson",
      email: "bob@example.com",
      organization: "StartupXYZ",
      type: "user",
    },
  ],
  organizations: [
    { id: "1", name: "Acme Corporation", domain: "acme.com", users: 245, type: "organization" },
    {
      id: "2",
      name: "Tech Solutions Inc",
      domain: "techsolutions.com",
      users: 89,
      type: "organization",
    },
    {
      id: "3",
      name: "Design Studio",
      domain: "designstudio.com",
      users: 156,
      type: "organization",
    },
    { id: "4", name: "StartupXYZ", domain: "startupxyz.com", users: 23, type: "organization" },
  ],
  teams: [
    { id: "1", name: "Engineering", organization: "Acme Corporation", members: 15, type: "team" },
    { id: "2", name: "Design", organization: "Design Studio", members: 8, type: "team" },
    { id: "3", name: "Marketing", organization: "Tech Solutions Inc", members: 6, type: "team" },
    { id: "4", name: "Product", organization: "StartupXYZ", members: 4, type: "team" },
  ],
  bookings: [
    {
      id: "1",
      title: "Team Meeting Room A",
      user: "John Doe",
      date: "Dec 15, 2023",
      type: "booking",
    },
    {
      id: "2",
      title: "Client Presentation",
      user: "Jane Smith",
      date: "Dec 16, 2023",
      type: "booking",
    },
    { id: "3", title: "Design Review", user: "Alice Brown", date: "Dec 17, 2023", type: "booking" },
    { id: "4", title: "Product Demo", user: "Bob Johnson", date: "Dec 18, 2023", type: "booking" },
  ],
  files: [
    { id: "1", name: "Project Proposal.pdf", owner: "John Doe", size: "2.4 MB", type: "file" },
    { id: "2", name: "Design Assets.zip", owner: "Alice Brown", size: "15.7 MB", type: "file" },
    { id: "3", name: "Product Demo.mp4", owner: "Bob Johnson", size: "45.2 MB", type: "file" },
    { id: "4", name: "Brand Guidelines.png", owner: "Jane Smith", size: "3.1 MB", type: "file" },
  ],
};

export interface SearchResult {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  domain?: string;
  organization?: string;
  user?: string;
  owner?: string;
  date?: string;
  size?: string;
  users?: number;
  members?: number;
  type: string;
}

interface GlobalSearchProps {
  onResultClick?: (result: SearchResult) => void;
}

export function GlobalSearch({ onResultClick }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search function
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const allResults: SearchResult[] = [];

    // Search users
    searchData.users.forEach((user) => {
      if (user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) {
        allResults.push(user);
      }
    });

    // Search organizations
    searchData.organizations.forEach((org) => {
      if (org.name.toLowerCase().includes(query) || org.domain.toLowerCase().includes(query)) {
        allResults.push(org);
      }
    });

    // Search teams
    searchData.teams.forEach((team) => {
      if (
        team.name.toLowerCase().includes(query) ||
        team.organization.toLowerCase().includes(query)
      ) {
        allResults.push(team);
      }
    });

    // Search bookings
    searchData.bookings.forEach((booking) => {
      if (
        booking.title.toLowerCase().includes(query) ||
        booking.user.toLowerCase().includes(query)
      ) {
        allResults.push(booking);
      }
    });

    // Search files
    searchData.files.forEach((file) => {
      if (file.name.toLowerCase().includes(query) || file.owner.toLowerCase().includes(query)) {
        allResults.push(file);
      }
    });

    setResults(allResults.slice(0, 10)); // Limit to 10 results
  };

  // Handle search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        setSelectedIndex(-1);
      }

      // Arrow navigation
      if (isOpen && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        }
        if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault();
          handleResultClick(results[selectedIndex]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
    onResultClick?.(result);

    // You can implement navigation logic here
    console.log("Navigate to:", result);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "user":
        return <Users className="w-4 h-4 text-blue-500" />;
      case "organization":
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case "team":
        return <Users2 className="w-4 h-4 text-green-500" />;
      case "booking":
        return <Calendar className="w-4 h-4 text-orange-500" />;
      case "file":
        return <FileText className="w-4 h-4 text-red-500" />;
      default:
        return <Search className="w-4 h-4 text-gray-500" />;
    }
  };

  const getResultTitle = (result: SearchResult) => {
    return result.name || result.title || "Unknown";
  };

  const getResultSubtitle = (result: SearchResult) => {
    switch (result.type) {
      case "user":
        return result.email;
      case "organization":
        return `${result.domain} • ${result.users} users`;
      case "team":
        return `${result.organization} • ${result.members} members`;
      case "booking":
        return `${result.user} • ${result.date}`;
      case "file":
        return `${result.owner} • ${result.size}`;
      default:
        return "";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "user":
        return "User";
      case "organization":
        return "Organization";
      case "team":
        return "Team";
      case "booking":
        return "Booking";
      case "file":
        return "File";
      default:
        return type;
    }
  };

  return (
    <div ref={searchRef} className="relative z-50 flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search users, organizations, teams..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-8 pr-16 bg-background"
        />
        <div className="absolute flex items-center gap-1 right-2 top-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>
      </div>
      {/* Search Results Dropdown */}
      {isOpen && (query.trim() || results.length > 0) && (
        <Card className="absolute left-0 right-0 z-50 mt-2 border-0 shadow-xl top-full">
          <CardContent className="p-0">
            {results.length > 0 ? (
              <div className="overflow-y-auto max-h-96">
                {results.map((result, index) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors duration-150 ${
                      index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                    } ${index !== results.length - 1 ? "border-b border-gray-100" : ""}`}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex-shrink-0">{getResultIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getResultTitle(result)}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(result.type)}
                        </Badge>
                      </div>
                      {getResultSubtitle(result) && (
                        <p className="text-xs text-gray-500 truncate">
                          {getResultSubtitle(result)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
                <p className="mt-1 text-xs text-gray-400">
                  Try searching for users, organizations, teams, bookings, or files
                </p>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Start typing to search...</p>
                <p className="mt-1 text-xs text-gray-400">
                  Search across users, organizations, teams, bookings, and files
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
