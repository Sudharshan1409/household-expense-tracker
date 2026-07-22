"use client";

import { useHousehold } from "@/components/providers/household-provider";
import { ChevronDown, Home, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function HouseholdSwitcher() {
  const { households, activeHousehold, setActiveHouseholdId, isLoading } = useHousehold();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading || households.length === 0) {
    return (
      <div className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
    );
  }

  // If only 1 household, just display it as text instead of a dropdown
  if (households.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-sm font-medium">
        <Home className="w-4 h-4 text-muted-foreground" />
        {activeHousehold?.name}
      </div>
    );
  }

  return (
    <div className="relative group" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full md:min-w-[200px] bg-card border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
      >
        <div className="flex items-center gap-2 truncate">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{activeHousehold?.name || "Select Household"}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-full md:min-w-[200px] bg-card border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {households.map((h) => (
              <button
                key={h.householdId}
                onClick={() => {
                  setActiveHouseholdId(h.householdId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                  activeHousehold?.householdId === h.householdId 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="truncate">{h.name}</span>
                {activeHousehold?.householdId === h.householdId && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
