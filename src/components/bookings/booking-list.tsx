"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Phone, Video, ArrowUpDown } from "lucide-react";
import type { BookingWithSpecialist } from "@/types/booking";
import { useState } from "react";

const columnHelper = createColumnHelper<BookingWithSpecialist>();

interface BookingListProps {
  bookings: BookingWithSpecialist[];
}

export function BookingList({ bookings }: BookingListProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("examDate", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const date = info.getValue();
          return date ? format(new Date(date), "MMM dd, yyyy h:mm a") : "Not scheduled";
        },
      }),
      columnHelper.accessor((row) => `${row.patientFirstName} ${row.patientLastName}`, {
        id: "patientName",
        header: "Patient",
        cell: (info) => (
          <div>
            <p className="font-medium">{info.getValue()}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {info.row.original.patientPhone}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("examinationType", {
        header: "Type",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <span>{info.getValue()}</span>
            {info.row.original.examLocation === "telehealth" && (
              <Video className="h-4 w-4 text-blue-600" />
            )}
          </div>
        ),
      }),
      columnHelper.accessor("specialist", {
        header: "Specialist",
        cell: (info) => {
          const specialist = info.getValue();
          if (!specialist) {
            return <span className="text-muted-foreground">Not assigned</span>;
          }
          return (
            <div>
              <p className="font-medium">{specialist.name}</p>
              <p className="text-sm text-muted-foreground">{specialist.specialty}</p>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
            active: "default",
            closed: "secondary",
            archived: "outline",
          };
          const variant = variantMap[status] || "secondary";

          return (
            <Badge variant={variant}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <Link href={`/bookings/${info.row.original.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: bookings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search patients..."
          value={(table.getColumn("patientName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("patientName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}