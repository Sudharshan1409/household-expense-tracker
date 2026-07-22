"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { Wallet, Target, AlertTriangle } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers, updateCategoryBudgets } from "@/actions/household";
import { toast } from "sonner";

const CATEGORIES = [
  "Groceries", "Utilities", "Rent", "Dining Out", "Transportation", 
  "Travel", "Entertainment", "Healthcare", "Shopping", "Maintenance", 
  "Subscriptions", "Other"
];

export default function BudgetsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getISTMonthString = () => {
    const now = new Date();
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  useEffect(() => {
    async function loadData() {
      if (!activeHousehold?.householdId || !currentUserId) return;
      setIsLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          // Fetch transactions for actuals
          const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, selectedMonth);
          setTransactions(recentTx);
          
          // Fetch member record for individual category budgets
          const mems = await getHouseholdMembers(token, activeHousehold.householdId);
          const me = mems.find(m => m.userId === currentUserId);
          if (me?.categoryBudgets) {
            setCategoryBudgets(me.categoryBudgets);
          } else {
            setCategoryBudgets({});
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeHousehold?.householdId, currentUserId, selectedMonth]);

  const handleSaveBudgets = async () => {
    if (!activeHousehold?.householdId) return;
    setIsSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      // Clean up empty budgets
      const cleaned: Record<string, number> = {};
      Object.entries(categoryBudgets).forEach(([k, v]) => {
        if (v > 0) cleaned[k] = v;
      });

      await updateCategoryBudgets(token, activeHousehold.householdId, cleaned);
      setCategoryBudgets(cleaned);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast("Failed to save budgets");
    } finally {
      setIsSaving(false);
    }
  };

  const updateBudget = (cat: string, val: string) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [cat]: parseFloat(val) || 0
    }));
  };

  if (isHouseholdLoading || isLoading) {
    return <PageLoader title="Loading budget data..." />;
  }

  // Calculate actuals based ONLY on the user's individual share of the split
  const actualsMap = transactions.reduce((acc, tx) => {
    const cat = tx.category || "Other";
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    acc[cat] = (acc[cat] || 0) + myShare;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Set category limits and track your spending.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="flex justify-end">
        <input 
          type="month" 
          value={selectedMonth}
          max={getISTMonthString()}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        />
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Category Budgets</h2>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveBudgets} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Budgets"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit Budgets
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {CATEGORIES.map(cat => {
              const actual = actualsMap[cat] || 0;
              const budget = categoryBudgets[cat] || 0;
              const hasBudget = budget > 0;
              const progress = hasBudget ? Math.min((actual / budget) * 100, 100) : 0;
              const isOver = hasBudget && actual > budget;
              const isWarning = hasBudget && progress >= 80 && !isOver;

              if (!hasBudget && !isEditing && actual === 0) return null; // Hide completely empty unbudgeted categories unless editing

              return (
                <div key={cat} className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{cat}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-32 relative">
                        <input
                          type="number"
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-right"
                          placeholder="0"
                          value={categoryBudgets[cat] || ""}
                          onChange={(e) => updateBudget(cat, e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {hasBudget ? `Budget: ₹${budget.toFixed(2)}` : "No Budget Set"}
                      </span>
                    )}
                  </div>
                  
                  {!isEditing && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={isOver ? "text-destructive font-medium flex items-center gap-1" : ""}>
                          {isOver && <AlertTriangle className="h-3 w-3" />}
                          ₹{actual.toFixed(2)} spent
                        </span>
                        {hasBudget && (
                          <span className="text-muted-foreground">
                            {progress.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      
                      {hasBudget ? (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div 
                            className={`h-full transition-all duration-500 ${isOver ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-2 w-full rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          <div className="h-full bg-primary/20" style={{ width: '100%' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
