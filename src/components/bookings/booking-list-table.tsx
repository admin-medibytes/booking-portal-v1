"use client";

import { useState, memo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Calendar,
  Clock,
  Mail,
  Phone,
  Building2,
  Clock4,
  XCircle,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookingWithSpecialist } from "@/types/booking";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Memoized cell components for performance
const SpecialistCell = memo(
  ({ specialist }: { specialist: BookingWithSpecialist["specialist"] }) => {
    if (!specialist) {
      return <span className="text-muted-foreground">Not assigned</span>;
    }
    return (
      <div>
        <div className="font-medium">{specialist.name}</div>
        <div className="text-sm text-muted-foreground">{specialist.user?.jobTitle}</div>
      </div>
    );
  }
);
SpecialistCell.displayName = "SpecialistCell";

const StatusBadge = memo(({ status }: { status: string }) => {
  const variantMap: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    closed: "secondary",
    archived: "outline",
  };
  const variant = variantMap[status] || "secondary";

  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
});
StatusBadge.displayName = "StatusBadge";

interface BookingListTableProps {
  bookings: BookingWithSpecialist[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const BookingListTable = memo(function BookingListTable({
  bookings,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: BookingListTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns: ColumnDef<BookingWithSpecialist>[] = [
    {
      id: "examinee",
      header: "Examinee",
      cell: ({ row }) => {
        const booking = row.original;
        return (
          <div className="space-y-1 flex items-center">
            <Link href={`/bookings/${booking.id}`} className="group space-y-1 w-fit">
              <div className="font-medium group-hover:font-bold">
                {booking.examinee.firstName} {booking.examinee.lastName}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{booking.examinee.email}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span className="font-mono">{booking.examinee.phoneNumber}</span>
              </div>
            </Link>
          </div>
        );
      },
    },
    {
      id: "specialist",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Specialist
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const specialist = row.original.specialist;
        if (!specialist) {
          return <span className="text-muted-foreground">Not assigned</span>;
        }
        return (
          <div>
            <div className="font-medium">{specialist.name}</div>
            <div className="text-sm text-muted-foreground">{specialist.user?.jobTitle}</div>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.specialist?.name || "";
        const b = rowB.original.specialist?.name || "";
        return a.localeCompare(b);
      },
    },
    {
      id: "appointment",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Appointment
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const booking = row.original;
        const color =
          booking.type === "telehealth"
            ? "bg-blue-100 border-blue-200 text-blue-700"
            : "bg-violet-100 border-violet-200 text-violet-700";

        return (
          <div className="space-y-1">
            <div
              className={cn(
                "text-xs px-2 py-.5 font-medium border capitalize w-fit rounded",
                color
              )}
            >
              {booking.type}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {booking.dateTime
                  ? format(new Date(booking.dateTime), "MMM dd, yyyy")
                  : "Not scheduled"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{booking.dateTime ? format(new Date(booking.dateTime), "h:mm a") : "--"}</span>
            </div>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.dateTime ? new Date(rowA.original.dateTime).getTime() : 0;
        const b = rowB.original.dateTime ? new Date(rowB.original.dateTime).getTime() : 0;
        return a - b;
      },
    },
    {
      id: "case",
      header: "Case",
      cell: ({ row }) => {
        const booking = row.original;
        if (!booking.examinee) {
          return <span className="text-muted-foreground">No case info</span>;
        }

        const color = booking.status === "active" ? "green" : "red";
        return (
          <div className="space-y-1">
            <div
              className={cn(
                "text-xs px-2 py-.5 font-medium border capitalize w-fit rounded",
                `bg-${color}-100 border-${color}-200 text-${color}-700`
              )}
            >
              {booking.status}
            </div>
            <div className="text-sm text-muted-foreground">{booking.examinee.caseType}</div>
            <div className="text-sm text-muted-foreground max-w-[300px] truncate">{booking.examinee.condition}</div>
          </div>
        );
      },
    },
    {
      id: "referrer",
      header: "Referrer",
      cell: ({ row }) => {
        const booking = row.original;
        if (!booking.referrer) {
          return <span className="text-muted-foreground">No referrer info</span>;
        }
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {booking.referrer.firstName} {booking.referrer.lastName}
            </div>
            {booking.referrerOrganization?.name && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{booking.referrerOrganization.name}</span>
              </div>
            )}
            {booking.referrer.email && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{booking.referrer.email}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const booking = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {booking.type === "telehealth" && booking.location && (
                <>
                  <DropdownMenuItem onClick={() => window.open(booking.location, "_blank")}>
                    <Video className="mr-2 h-4 w-4" />
                    Join Meeting
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => router.push(`/bookings/${booking.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                See Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  router.push(`/bookings/${booking.id}/reschedule`);
                }}
              >
                <Clock4 className="mr-2 h-4 w-4" />
                Reschedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  // TODO: Implement cancel logic
                  console.log("Cancel", booking.id);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: bookings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-4">
      <div className="rounded-md border shadow">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {startRange} to {endRange} of {totalCount} bookings
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Items per page</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.ceil(totalCount / pageSize)) }, (_, i) => {
                const pageNumber = i + 1;
                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNumber)}
                    className="w-8"
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              {Math.ceil(totalCount / pageSize) > 5 && (
                <>
                  <span className="mx-1">...</span>
                  <Button
                    variant={
                      currentPage === Math.ceil(totalCount / pageSize) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => onPageChange(Math.ceil(totalCount / pageSize))}
                    className="w-8"
                  >
                    {Math.ceil(totalCount / pageSize)}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === Math.ceil(totalCount / pageSize)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
