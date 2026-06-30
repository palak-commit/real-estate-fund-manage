"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "./Calendar";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  align?: "left" | "right";
  // When provided, a × button appears while a date is selected to clear the filter.
  onClear?: () => void;
  minDate?: string; // YYYY-MM-DD — disable days before this
  maxDate?: string; // YYYY-MM-DD — disable days after this
}

export function CustomDatePicker({ value, onChange, className = "", align = "left", onClear, minDate, maxDate }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse YYYY-MM-DD safely
  const dateObj = value ? new Date(value + "T12:00:00") : new Date();

  const handleDateChange = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const normalizedDate = new Date(date.getTime() - offset * 60 * 1000);
    const isoString = normalizedDate.toISOString().split("T")[0];
    onChange(isoString);
    setIsOpen(false);
  };

  const formattedDisplay = value 
    ? dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <span>{formattedDisplay}</span>
        {onClear && value ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setIsOpen(false);
            }}
            className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 animate-fade-in ${align === "right" ? "right-0" : "left-0"}`}>
          <Calendar
            value={dateObj}
            onChange={handleDateChange}
            min={minDate ? new Date(minDate + "T12:00:00") : undefined}
            max={maxDate ? new Date(maxDate + "T12:00:00") : undefined}
          />
        </div>
      )}
    </div>
  );
}
