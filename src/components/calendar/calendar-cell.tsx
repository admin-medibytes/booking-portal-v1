import { cn } from "@/lib/utils";
import {
  type CalendarDate,
  getLocalTimeZone,
  isSameMonth,
  isToday,
} from "@internationalized/date";
import { useCalendarCell } from "@react-aria/calendar";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { CalendarState } from "@react-stately/calendar";
import { useRef } from "react";

export function CalendarCell({
  state,
  date,
  currentMonth,
  hasAvailability = false,
  isLoading = false,
}: {
  state: CalendarState;
  date: CalendarDate;
  currentMonth: CalendarDate;
  hasAvailability?: boolean;
  isLoading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { cellProps, buttonProps, isSelected, isDisabled, formattedDate } =
    useCalendarCell({ date }, state, ref);

  const isOutsideMonth = !isSameMonth(currentMonth, date);

  const isDateToday = isToday(date, getLocalTimeZone());

  const { focusProps, isFocusVisible } = useFocusRing();

  // Only allow interaction if the date has availability
  const isInteractive = hasAvailability && !isDisabled;
  
  // Filter out onClick from buttonProps if not interactive
  const interactiveProps = isInteractive 
    ? buttonProps 
    : { ...buttonProps, onClick: undefined, onPointerDown: undefined, onPointerUp: undefined };

  return (
    <td
      {...cellProps}
      className={cn("py-0.5 relative px-0.5", isFocusVisible ? "z-10" : "z-0")}
    >
      <div
        {...mergeProps(interactiveProps, focusProps)}
        ref={ref}
        hidden={isOutsideMonth}
        className={cn(
          "size-14 outline-none group rounded-md",
          !isInteractive && "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "size-full rounded-md flex items-center justify-center",
            "text-gray-900 text-sm font-semibold",
            // Loading state
            isLoading && "animate-pulse bg-gray-200",
            !isLoading && !isInteractive
              ? isDateToday
                ? "cursor-not-allowed text-gray-500"
                : "text-gray-400 cursor-not-allowed"
              : !isLoading && "cursor-pointer bg-white border border-gray-200",
            // Focus ring, visible while the cell has keyboard focus.
            isFocusVisible && isInteractive && !isLoading &&
              "ring-2 group-focus:z-2 ring-gray-900 ring-offset-1",
            // Darker selection background for the start and end.
            isSelected && isInteractive && !isLoading && "bg-gray-900 text-white border-gray-900",
            // Hover state for interactive cells.
            !isSelected && isInteractive && !isLoading && "hover:border-gray-400",
            // Show availability indicator
            hasAvailability && !isSelected && !isLoading && "border-gray-300"
          )}
        >
          {!isLoading && formattedDate}
          {isDateToday && (
            <div
              className={cn(
                "absolute bottom-4 left-1/2 transform -translate-x-1/2 translate-y-1/2 size-1.5 bg-gray-900 rounded-full",
                isSelected && "bg-white"
              )}
            />
          )}
        </div>
      </div>
    </td>
  );
}