"use client";

import * as React from "react";
import { format, startOfDay } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  /** Time used when a day is picked before a time is chosen (HH:mm). */
  defaultTime?: string;
}

const combine = (day: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(day);
  combined.setHours(hours || 0, minutes || 0, 0, 0);
  return combined;
};

/**
 * Inline date + time picker. Renders the calendar directly (no popover), so it
 * works reliably inside dialogs. Days before today are disabled; today is allowed.
 */
export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
  defaultTime = "23:59",
}: DateTimePickerProps) {
  const [day, setDay] = React.useState<Date | undefined>(value ? startOfDay(value) : undefined);
  const [time, setTime] = React.useState<string>(value ? format(value, "HH:mm") : defaultTime);

  React.useEffect(() => {
    if (value) {
      setDay(startOfDay(value));
      setTime(format(value, "HH:mm"));
    }
  }, [value]);

  const handleDaySelect = (selected: Date | undefined) => {
    setDay(selected);
    onChange(selected ? combine(selected, time) : undefined);
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (day && newTime) onChange(combine(day, newTime));
  };

  const today = startOfDay(new Date());

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-md border w-fit">
        <Calendar
          mode="single"
          selected={day}
          onSelect={handleDaySelect}
          disabled={disabled ? true : { before: today }}
          defaultMonth={day ?? today}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="due-time" className="text-sm font-medium">
          Time
        </Label>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            id="due-time"
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}
