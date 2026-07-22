"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/components/providers/household-provider";
import { updateHouseholdCategories } from "@/actions/household";
import { fetchAuthSession } from "aws-amplify/auth";
import { Trash2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

export function CategoriesManager() {
  const { activeHousehold, refreshHouseholds } = useHousehold();
  
  const [categories, setCategories] = useState<string[]>(activeHousehold?.categories || []);
  const [newCat, setNewCat] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!activeHousehold) return null;
  const isOwner = activeHousehold.role === "OWNER";

  const handleSave = async (updatedCategories: string[]) => {
    if (!isOwner) return;
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      await updateHouseholdCategories(token, activeHousehold.householdId, updatedCategories);
      setCategories(updatedCategories);
      await refreshHouseholds();
    } catch (e) {
      console.error(e);
      toast("Failed to update categories. Only Owners can do this.");
    } finally {
      setIsLoading(false);
    }
  };

  const addCategory = () => {
    if (!newCat.trim()) return;
    if (categories.includes(newCat.trim())) {
      toast("Category already exists!");
      return;
    }
    const updated = [...categories, newCat.trim()];
    setNewCat("");
    handleSave(updated);
  };

  const removeCategory = (catToRemove: string) => {
    const updated = categories.filter(c => c !== catToRemove);
    handleSave(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input 
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New Category Name"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={!isOwner || isLoading}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
        />
        <Button onClick={addCategory} disabled={!isOwner || isLoading || !newCat.trim()}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm font-medium border">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {cat}
            {isOwner && (
              <button 
                onClick={() => removeCategory(cat)}
                disabled={isLoading}
                className="ml-1 text-muted-foreground hover:text-destructive focus:outline-none"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!isOwner && (
        <p className="text-xs text-muted-foreground">Only the Household Owner can modify custom categories.</p>
      )}
    </div>
  );
}
