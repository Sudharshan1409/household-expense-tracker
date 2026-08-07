"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function MonthPicker({ value, onChange, className, placeholder = "Select Month" }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Extract year and month from value if available
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-');
      return new Date(parseInt(y), parseInt(m) - 1);
    }
    return new Date();
  });

  const selectedDate = value ? new Date(parseInt(value.split('-')[0]), parseInt(value.split('-')[1]) - 1) : null;
  const currentYear = currentViewDate.getFullYear();

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentYear, monthIndex);
    const val = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    onChange(val);
    setIsOpen(false);
  };

  const handleYearChange = (offset: number) => {
    setCurrentViewDate(prev => {
      const d = new Date(prev);
      d.setFullYear(d.getFullYear() + offset);
      return d;
    });
  };

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-[180px] justify-between text-left font-normal px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate">
              {value ? format(selectedDate!, "MMMM yyyy") : placeholder}
            </span>
          </div>
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </Button>
      } />
      <PopoverContent className="w-[240px] p-2" align="start">
        <div className="flex items-center justify-between pb-2 mb-2 border-b">
          <Button variant="ghost" size="icon" onClick={() => handleYearChange(-1)} className="h-7 w-7">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm">{currentYear}</div>
          <Button variant="ghost" size="icon" onClick={() => handleYearChange(1)} className="h-7 w-7">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, i) => {
            const isSelected = selectedDate?.getFullYear() === currentYear && selectedDate?.getMonth() === i;
            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                className={cn("h-9 text-xs", isSelected && "font-bold")}
                onClick={() => handleMonthSelect(i)}
              >
                {month}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
