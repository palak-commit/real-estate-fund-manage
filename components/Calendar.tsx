"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  className?: string;
  min?: Date; // earliest selectable day (inclusive)
  max?: Date; // latest selectable day (inclusive)
}

export function Calendar({ value, onChange, className = "", min, max }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(value || new Date());

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const today = new Date();
  
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  const dayValue = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const isDisabled = (date: Date) => {
    const d = dayValue(date);
    if (min && d < dayValue(min)) return true;
    if (max && d > dayValue(max)) return true;
    return false;
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    const isSelected = value ? isSameDay(date, value) : false;
    const isToday = isSameDay(date, today);
    const disabled = isDisabled(date);

    days.push(
      <button
        key={i}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(date)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
          disabled
            ? "cursor-not-allowed text-muted-foreground/40"
            : isSelected
            ? "bg-primary text-primary-foreground font-medium"
            : isToday
            ? "bg-muted text-foreground font-medium"
            : "text-foreground hover:bg-muted"
        }`}
      >
        {i}
      </button>
    );
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className={`p-3 rounded-xl border border-border bg-card shadow-card w-[280px] ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-medium text-foreground">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="text-[11px] font-medium text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 justify-items-center">
        {days}
      </div>
    </div>
  );
}
