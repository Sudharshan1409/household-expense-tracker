"use client";

import { useHousehold } from "@/components/providers/household-provider";
import { ChevronDown, Home } from "lucide-react";

export function HouseholdSwitcher() {
  const { households, activeHousehold, setActiveHouseholdId, isLoading } = useHousehold();

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
    <div className="relative group">
      <select
        className="appearance-none w-full bg-card border rounded-lg px-4 py-2.5 pr-10 text-sm font-medium hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm"
        value={activeHousehold?.householdId || ""}
        onChange={(e) => setActiveHouseholdId(e.target.value)}
      >
        {households.map((h) => (
          <option key={h.householdId} value={h.householdId}>
            {h.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );
}
