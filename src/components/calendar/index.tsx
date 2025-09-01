"use client";

import { createCalendar } from "@internationalized/date";
import { type CalendarProps, type DateValue, useCalendar } from "@react-aria/calendar";
import { useLocale } from "@react-aria/i18n";
import { useCalendarState } from "@react-stately/calendar";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";

interface ExtendedCalendarProps extends CalendarProps<DateValue> {
  availableDates?: Date[];
}

export function Calendar(props: ExtendedCalendarProps) {
  const { locale } = useLocale();
  const { availableDates, ...calendarProps } = props;

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

  return (
    <div {...ariaCalendarProps} className="inline-block text-gray-800">
      <CalendarHeader
        state={state}
        calendarProps={ariaCalendarProps}
        prevButtonProps={prevButtonProps}
        nextButtonProps={nextButtonProps}
      />
      <div className="flex gap-8">
        <CalendarGrid state={state} availableDates={availableDates} />
      </div>
    </div>
  );
}
