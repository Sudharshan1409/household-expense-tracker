"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/components/providers/household-provider";
import { updateHouseholdCategories, updateHouseholdFixedCategories } from "@/actions/household";
import { fetchAuthSession } from "aws-amplify/auth";
import { Trash2, Plus, Tag, Anchor } from "lucide-react";
import { toast } from "sonner";

export function CategoriesManager() {
  const { activeHousehold, refreshHouseholds } = useHousehold();
  
  const [categories, setCategories] = useState<string[]>(activeHousehold?.categories || []);
  const [fixedCategories, setFixedCategories] = useState<string[]>(activeHousehold?.fixedCategories || []);
  const [newCat, setNewCat] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCategories(activeHousehold?.categories || []);
    setFixedCategories(activeHousehold?.fixedCategories || []);
  }, [activeHousehold?.categories, activeHousehold?.fixedCategories]);

  if (!activeHousehold) return null;
  const isOwnerOrAdmin = activeHousehold.role === "OWNER" || activeHousehold.role === "ADMIN";

  const handleSave = async (updatedCategories: string[]) => {
    if (!isOwnerOrAdmin) return;
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
      toast("Failed to update categories. Only Admins and Owners can do this.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFixedCategory = async (cat: string) => {
    if (!isOwnerOrAdmin) return;
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      const isFixed = fixedCategories.includes(cat);
      const updatedFixed = isFixed 
        ? fixedCategories.filter(c => c !== cat)
        : [...fixedCategories, cat];

      await updateHouseholdFixedCategories(token, activeHousehold.householdId, updatedFixed);
      setFixedCategories(updatedFixed);
      await refreshHouseholds();
      
      if (!isFixed) {
        toast.success(`"${cat}" marked as Fixed Expense`);
      } else {
        toast.success(`"${cat}" removed from Fixed Expenses`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update fixed categories.");
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
    const updatedFixed = fixedCategories.filter(c => c !== catToRemove);
    handleSave(updated);
    if (fixedCategories.includes(catToRemove)) {
      toggleFixedCategory(catToRemove); // Will sync fixed categories as well, though a bit inefficient.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input 
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New Category Name"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={!isOwnerOrAdmin || isLoading}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
        />
        <Button onClick={addCategory} disabled={!isOwnerOrAdmin || isLoading || !newCat.trim()}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {categories.map(cat => {
          const isFixed = fixedCategories.includes(cat);
          return (
            <div key={cat} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${isFixed ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted'}`}>
              <Tag className="h-3 w-3 opacity-70" />
              {cat}
              {isOwnerOrAdmin && (
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border/50">
                  <button 
                    onClick={() => toggleFixedCategory(cat)}
                    disabled={isLoading}
                    title={isFixed ? "Unmark as Fixed Expense" : "Mark as Fixed Expense"}
                    className={`focus:outline-none transition-colors ${isFixed ? 'text-primary hover:text-primary/70' : 'text-muted-foreground hover:text-primary'}`}
                  >
                    <Anchor className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => removeCategory(cat)}
                    disabled={isLoading}
                    title="Delete Category"
                    className="text-muted-foreground hover:text-destructive focus:outline-none ml-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!isOwnerOrAdmin && (
        <p className="text-xs text-muted-foreground">Only Admins and Owners can modify custom categories.</p>
      )}
    </div>
  );
}
