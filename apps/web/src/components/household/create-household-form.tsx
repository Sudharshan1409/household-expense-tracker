"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAuthSession } from "aws-amplify/auth";
import { createHousehold } from "@/actions/household";
import { useRouter } from "next/navigation";

export function CreateHouseholdForm() {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !budget) return;

    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) throw new Error("No token found");

      const parsedBudget = parseFloat(budget);
      if (isNaN(parsedBudget)) throw new Error("Invalid budget");

      await createHousehold(token, name.trim(), parsedBudget);
      
      setIsSuccess(true);
      // Wait for DynamoDB GSI to synchronize before checking auth guard again
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to create household", error);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <label htmlFor="householdName" className="text-sm font-medium leading-none">
          Household Name
        </label>
        <input
          id="householdName"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g. My Apartment, The Smiths"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading || isSuccess}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="budget" className="text-sm font-medium leading-none">
          Your Monthly Budget (₹)
        </label>
        <input
          id="budget"
          type="number"
          step="0.01"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g. 50000"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={isLoading || isSuccess}
        />
        <p className="text-xs text-muted-foreground">You can change this later in settings.</p>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || isSuccess || !name.trim() || !budget}>
        {isSuccess ? "Created! Redirecting..." : isLoading ? "Creating..." : "Create Household"}
      </Button>
    </form>
  );
}
