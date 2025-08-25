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
import { ArrowUpDown, Eye } from "lucide-react";
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
import type { BookingWithSpecialist } from "@/types/booking";

// Memoized cell components for performance
const SpecialistCell = memo(
  ({ specialist }: { specialist: BookingWithSpecialist["specialist"] }) => {
    if (!specialist) {
      return <span className="text-muted-foreground">Not assigned</span>;
    }
    return (
      <div>
        <div className="font-medium">{specialist.name}</div>
        <div className="text-sm text-muted-foreground">{specialist.jobTitle || "N/a"}</div>
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
      accessorKey: "examDate",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.getValue("examDate") as string | null;
        if (!date) return <span className="text-muted-foreground">Not scheduled</span>;
        return format(new Date(date), "MMM dd, yyyy");
      },
    },
    {
      id: "time",
      accessorKey: "examDate",
      header: "Time",
      cell: ({ row }) => {
        const date = row.getValue("examDate") as string | null;
        if (!date) return <span className="text-muted-foreground">-</span>;
        return format(new Date(date), "h:mm a");
      },
    },
    {
      id: "examinee",
      accessorFn: (row) => `${row.patientFirstName} ${row.patientLastName}`,
      header: "Examinee",
    },
    {
      accessorKey: "specialist",
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
        const specialist = row.getValue("specialist") as BookingWithSpecialist["specialist"];
        return <SpecialistCell specialist={specialist} />;
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.specialist?.name || "";
        const b = rowB.original.specialist?.name || "";
        return a.localeCompare(b);
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <StatusBadge status={status} />;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/bookings/${row.original.id}`)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
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
      <div className="rounded-md border">
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
