"use client";

import { createCalendar } from "@internationalized/date";
import { type CalendarProps, type DateValue, useCalendar } from "@react-aria/calendar";
import { useLocale } from "@react-aria/i18n";
import { useCalendarState } from "@react-stately/calendar";
import { useEffect, useRef } from "react";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";

interface ExtendedCalendarProps extends CalendarProps<DateValue> {
  availableDates?: string[];
  isLoading?: boolean;
  onVisibleRangeChange?: (month: number, year: number) => void;
}

export function Calendar(props: ExtendedCalendarProps) {
  const { locale } = useLocale();
  const { availableDates, isLoading, onVisibleRangeChange, ...calendarProps } = props;

  const state = useCalendarState({
    ...calendarProps,
    visibleDuration: { months: 1 },
    locale,
    createCalendar,
  });

  const {
    calendarProps: ariaCalendarProps,
    prevButtonProps,
    nextButtonProps,
  } = useCalendar(calendarProps, state);

  // Track the visible month and notify parent when it changes
  const prevMonthYearRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    const month = state.visibleRange.start.month;
    const year = state.visibleRange.start.year;
    const monthYearKey = `${month}-${year}`;
    
    if (onVisibleRangeChange && prevMonthYearRef.current !== monthYearKey) {
      onVisibleRangeChange(month, year);
      prevMonthYearRef.current = monthYearKey;
    }
  }, [state.visibleRange.start.month, state.visibleRange.start.year, onVisibleRangeChange]);

  return (
    <div {...ariaCalendarProps} className="inline-block text-gray-800">
      <CalendarHeader
        state={state}
        calendarProps={ariaCalendarProps}
        prevButtonProps={prevButtonProps}
        nextButtonProps={nextButtonProps}
      />
      <div className="flex gap-8">
        <CalendarGrid state={state} availableDates={availableDates} isLoading={isLoading} />
      </div>
    </div>
  );
}
