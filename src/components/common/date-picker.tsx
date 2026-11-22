"use client";

import * as React from "react";
import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export interface DatePickerProps {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string; // Format: "YYYY-MM-DD"
  onChange?: (dateString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
  startYear?: number;
  endYear?: number;
  /** Batas bawah/atas yang bisa dipilih (YYYY-MM-DD). */
  min?: string;
  max?: string;
  /** Bulan yang ditampilkan saat belum ada nilai (YYYY-MM-DD). Default: hari ini. */
  defaultMonth?: string;
  name?: string;
}

function parseYMD(dateStr?: string): Date | undefined {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return undefined;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? undefined : date;
}

function formatYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr?: string): string | null {
  const date = parseYMD(dateStr);
  if (!date) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function DatePicker({
  label,
  error,
  helperText,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  required,
  startYear = new Date().getFullYear() - 15,
  endYear = new Date().getFullYear() + 5,
  min,
  max,
  defaultMonth,
  name,
}: DatePickerProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseYMD(value), [value]);
  const displayDate = React.useMemo(() => formatDisplayDate(value), [value]);

  const minDate = React.useMemo(() => parseYMD(min), [min]);
  const maxDate = React.useMemo(() => parseYMD(max), [max]);
  const defaultMonthDate = React.useMemo(() => {
    const explicit = parseYMD(defaultMonth);
    if (explicit) return explicit;
    const today = new Date();
    if (maxDate && today > maxDate) return maxDate;
    if (minDate && today < minDate) return minDate;
    return today;
  }, [defaultMonth, minDate, maxDate]);
  const disabledDays = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <Label
          htmlFor={inputId}
          className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1"
        >
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full h-9 justify-between px-3 text-xs font-normal bg-background hover:bg-background border-input shadow-xs transition-colors cursor-pointer",
              !value && "text-muted-foreground",
              value && "text-foreground font-medium",
              error && "border-destructive focus-visible:ring-destructive/30",
              className
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">
                {displayDate ?? placeholder ?? "Pilih tanggal"}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange?.("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onChange?.("");
                    }
                  }}
                  title="Hapus tanggal"
                  className="rounded-full p-0.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="size-3" />
                </span>
              )}
              <ChevronDown className="size-3.5 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="w-auto p-0 max-w-[calc(100vw-2rem)] overflow-hidden shadow-lg border-border/80"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                onChange?.(formatYMD(d));
                setOpen(false);
              }
            }}
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={new Date(endYear, 11)}
            defaultMonth={selectedDate ?? defaultMonthDate}
            disabled={disabledDays}
            className="rounded-lg"
          />
        </PopoverContent>
      </Popover>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required
          value={value ?? ""}
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
      {!error && helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
