"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface Option {
  label: string;
  value: string;
}

export interface GroupOption {
  group: string;
  items: Option[];
}

type SelectOption = Option | GroupOption;

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
}: CustomSelectProps) {
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

  const flatOptions = options.reduce<Option[]>((acc, opt) => {
    if ("group" in opt) {
      return [...acc, ...opt.items];
    }
    return [...acc, opt];
  }, []);

  const selectedOption = flatOptions.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className} ${disabled ? "opacity-70 cursor-not-allowed" : ""}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed"
      >
        <span className={selectedOption ? "" : "text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-card animate-fade-in">
          {options.map((option, idx) => {
            if ("group" in option) {
              return (
                <div key={`group-${idx}`}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {option.group}
                  </div>
                  {option.items.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        value === item.value ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                      }`}
                      onClick={() => {
                        onChange(item.value);
                        setIsOpen(false);
                      }}
                    >
                      {item.label}
                      {value === item.value && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  value === option.value ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
                {value === option.value && <Check className="h-4 w-4" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No options found.</div>
          )}
        </div>
      )}
    </div>
  );
}
