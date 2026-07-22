"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getUserHouseholds, getHousehold } from "@/actions/household";
import { usePathname } from "next/navigation";

interface Household {
  householdId: string;
  name: string;
  role: string;
  monthlyBudget: number;
  categories: string[];
}

interface HouseholdContextType {
  households: Household[];
  activeHousehold: Household | null;
  setActiveHouseholdId: (id: string) => void;
  isLoading: boolean;
  refreshHouseholds: () => Promise<void>;
  currentUserId: string | null;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeHouseholdId, setActiveHouseholdIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pathname = usePathname();

  const fetchHouseholds = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      setCurrentUserId(payload.sub);

      const memberships = await getUserHouseholds(token);
      
      const detailedHouseholds = await Promise.all(
        memberships.map(async (m: any) => {
          const meta = await getHousehold(token, m.householdId);
          return {
            householdId: m.householdId,
            role: m.role,
            name: meta?.name || "Unknown Household",
            monthlyBudget: m.budget || 50000,
            categories: meta?.categories || ["Groceries", "Utilities", "Rent", "Dining Out", "Transportation", "Travel", "Entertainment", "Healthcare", "Shopping", "Maintenance", "Subscriptions", "Other"],
          };
        })
      );

      setHouseholds(detailedHouseholds);

      // Restore active from localStorage or pick first
      const storedId = localStorage.getItem("activeHouseholdId");
      if (storedId && detailedHouseholds.find((h) => h.householdId === storedId)) {
        setActiveHouseholdIdState(storedId);
      } else if (detailedHouseholds.length > 0) {
        setActiveHouseholdIdState(detailedHouseholds[0].householdId);
        localStorage.setItem("activeHouseholdId", detailedHouseholds[0].householdId);
      } else {
        setActiveHouseholdIdState(null);
        localStorage.removeItem("activeHouseholdId");
      }
    } catch (err) {
      console.error("Failed to load households in context", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();
  }, [pathname]);

  const setActiveHouseholdId = (id: string) => {
    setActiveHouseholdIdState(id);
    localStorage.setItem("activeHouseholdId", id);
  };

  const activeHousehold = households.find(h => h.householdId === activeHouseholdId) || null;

  return (
    <HouseholdContext.Provider
      value={{
        households,
        activeHousehold,
        setActiveHouseholdId,
        isLoading,
        refreshHouseholds: fetchHouseholds,
        currentUserId,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
