"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { Wallet, Target, AlertTriangle, Info, Edit2, X } from "lucide-react";
import { useAuthSWR } from "@/hooks/use-auth-swr";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers, updateCategoryBudgets, updateHouseholdSettings, updateMemberBudget } from "@/actions/household";
import { MonthPicker } from "@/components/ui/month-picker";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import { fetchAuthSession } from "aws-amplify/auth";

export default function BudgetsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId, refreshHouseholds } = useHousehold();
  
  // Overall Budget State
  const [isEditingOverall, setIsEditingOverall] = useState(false);
  const [overallBudget, setOverallBudget] = useState("50000");
  
  // Category Budget State
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // My Budget State
  const [isEditingMyBudget, setIsEditingMyBudget] = useState(false);
  const [myBudgetInput, setMyBudgetInput] = useState("");

  useEffect(() => {
    if (activeHousehold?.monthlyBudget) {
      setMyBudgetInput(activeHousehold.monthlyBudget.toString());
    }
  }, [activeHousehold?.monthlyBudget]);

  const getISTMonthString = () => {
    const now = new Date();
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  const { data: transactions = [], isLoading: isTxLoading, mutate: mutateTx } = useAuthSWR(
    getRecentTransactions,
    activeHousehold?.householdId,
    [1000, selectedMonth]
  );

  const { data: mems = [], isLoading: isMemsLoading } = useAuthSWR(
    getHouseholdMembers,
    activeHousehold?.householdId
  );

  const isLoading = isTxLoading || isMemsLoading;

  useEffect(() => {
    // Set overall budget from context
    setOverallBudget(activeHousehold?.overallBudget?.toString() || "50000");

    // Sync individual category budgets
    if (mems && currentUserId) {
      const me = mems.find((m: any) => m.userId === currentUserId);
      if (me?.categoryBudgets) {
        setCategoryBudgets(me.categoryBudgets);
      } else {
        setCategoryBudgets({});
      }
    }
  }, [activeHousehold?.overallBudget, mems, currentUserId]);

  const handleSaveMyBudget = async () => {
    if (!activeHousehold?.householdId || !currentUserId) return;
    setIsSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      const numBudget = parseFloat(myBudgetInput);
      if (isNaN(numBudget) || numBudget < 0) throw new Error("Invalid budget");

      await updateMemberBudget(token, activeHousehold.householdId, numBudget);
      
      toast.success("My budget updated");
      setIsEditingMyBudget(false);
      refreshHouseholds();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update personal budget");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOverallBudget = async () => {
    if (!activeHousehold?.householdId) return;
    setIsSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      const numBudget = parseFloat(overallBudget);
      if (isNaN(numBudget) || numBudget < 0) throw new Error("Invalid budget");

      await updateHouseholdSettings(token, activeHousehold.householdId, { 
        name: activeHousehold.name, 
        monthlyBudget: numBudget 
      });
      
      toast.success("Household budget updated");
      setIsEditingOverall(false);
      refreshHouseholds();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update household budget");
    } finally {
      setIsSaving(false);
    }
  };

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
      toast.success("Category budgets saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save budgets");
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

  // Calculate actuals based ONLY on the user's individual share of the split, ignoring INCOME transactions
  const expenseTxs = transactions.filter(tx => tx.transactionType !== "INCOME");
  const actualsMap = expenseTxs.reduce((acc, tx) => {
    const cat = tx.category || "Other";
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    acc[cat] = (acc[cat] || 0) + myShare;
    return acc;
  }, {} as Record<string, number>);

  const totalMySpend = Object.values(actualsMap).reduce((a: number, b: any) => a + (b as number), 0);
  const totalHouseholdSpend = expenseTxs.reduce((a: number, b: any) => a + (b.amount || 0), 0);
  const overallBudgetNum = parseFloat(overallBudget) || 0;
  const overallProgress = overallBudgetNum > 0 ? (totalHouseholdSpend / overallBudgetNum) * 100 : 0;
  
  const myBudgetNum = activeHousehold?.monthlyBudget || 0;
  const myProgress = myBudgetNum > 0 ? (totalMySpend / myBudgetNum) * 100 : 0;

  // Date and Daily calculations
  const isCurrentMonth = selectedMonth === getISTMonthString();
  const daysInMonth = new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate();
  const currentDay = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const daysLeft = daysInMonth - currentDay + 1;

  const householdBudgetRemaining = overallBudgetNum - totalHouseholdSpend;
  const householdDailyLimit = (overallBudgetNum > 0 && householdBudgetRemaining > 0 && isCurrentMonth) ? householdBudgetRemaining / daysLeft : 0;

  const myBudgetRemaining = myBudgetNum - totalMySpend;
  const myDailyLimit = (myBudgetNum > 0 && myBudgetRemaining > 0 && isCurrentMonth) ? myBudgetRemaining / daysLeft : 0;

  const formatPercentage = (actual: number, budget: number) => {
    if (budget <= 0) return "0%";
    const pct = (actual / budget) * 100;
    if (pct >= 100) return `${Math.round(pct)}%`;
    if (Math.round(pct) === 100) return "99.9%";
    return `${Math.round(pct)}%`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Set household limits and track your spending.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="flex justify-end">
        <MonthPicker 
          value={selectedMonth} 
          onChange={(val) => setSelectedMonth(val)}
          className="w-[180px]"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overall Household Budget Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 overflow-hidden relative flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          
          <div className="relative space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">Overall Household Budget</h2>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-[200px] text-sm">This is the combined monthly spending limit for everyone in the household.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {isEditingOverall ? (
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <input
                      type="number"
                      value={overallBudget}
                      onChange={(e) => setOverallBudget(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveOverallBudget} disabled={isSaving}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingOverall(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl md:text-4xl font-bold tracking-tight">₹{overallBudgetNum.toLocaleString()}</span>
                  <span className="text-sm md:text-base text-muted-foreground font-medium">monthly limit</span>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingOverall(true)} className="ml-1 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between text-sm font-medium">
                <span>₹{totalHouseholdSpend.toLocaleString()} spent</span>
                <span className="text-muted-foreground">{formatPercentage(totalHouseholdSpend, overallBudgetNum)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${overallProgress > 100 ? 'bg-destructive' : overallProgress > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                  />
                </div>
                {overallBudgetNum > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {householdBudgetRemaining < 0 
                      ? <span className="text-destructive font-medium">Over by ₹{Math.abs(householdBudgetRemaining).toLocaleString()}</span>
                      : `₹${householdBudgetRemaining.toLocaleString()} left`
                    }
                    {isCurrentMonth && householdDailyLimit > 0 && ` • ₹${Math.round(householdDailyLimit).toLocaleString()}/day`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* My Monthly Budget Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 overflow-hidden relative flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          
          <div className="relative space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">My Monthly Budget</h2>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-[200px] text-sm">This is your personal spending limit. It tracks only your share of the household expenses.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {isEditingMyBudget ? (
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <input
                      type="number"
                      value={myBudgetInput}
                      onChange={(e) => setMyBudgetInput(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveMyBudget} disabled={isSaving}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingMyBudget(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl md:text-4xl font-bold tracking-tight">₹{myBudgetNum.toLocaleString()}</span>
                  <span className="text-sm md:text-base text-muted-foreground font-medium">monthly limit</span>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingMyBudget(true)} className="ml-1 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between text-sm font-medium">
                <span>₹{totalMySpend.toLocaleString()} spent</span>
                <span className="text-muted-foreground">{formatPercentage(totalMySpend, myBudgetNum)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(myProgress, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${myProgress > 100 ? 'bg-destructive' : myProgress > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  />
                </div>
                {myBudgetNum > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {myBudgetRemaining < 0 
                      ? <span className="text-destructive font-medium">Over by ₹{Math.abs(myBudgetRemaining).toLocaleString()}</span>
                      : `₹${myBudgetRemaining.toLocaleString()} left`
                    }
                    {isCurrentMonth && myDailyLimit > 0 && ` • ₹${Math.round(myDailyLimit).toLocaleString()}/day`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Budgets Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Your Category Budgets</h2>
            <Tooltip>
              <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
                <Info className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[200px] text-sm">These limits apply only to your personal share of expenses. They help you track your own spending inside the household.</p>
              </TooltipContent>
            </Tooltip>
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
            {(activeHousehold?.categories || []).map((cat: string) => {
              const actual = actualsMap[cat] || 0;
              const budget = categoryBudgets[cat] || 0;
              const hasBudget = budget > 0;
              const progress = hasBudget ? (actual / budget) * 100 : 0;
              const isOver = hasBudget && actual > budget;
              const isWarning = hasBudget && progress >= 80 && !isOver;

              if (!hasBudget && !isEditing && actual === 0) return null; // Hide completely empty unbudgeted categories unless editing

              return (
                <div 
                  key={cat} 
                  className={`p-4 rounded-xl border bg-card shadow-sm space-y-3 ${!isEditing ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
                  onClick={() => !isEditing && setSelectedCategory(cat)}
                >
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
                            {formatPercentage(actual, budget)}
                          </span>
                        )}
                      </div>
                      
                      {hasBudget ? (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isOver ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
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

      {/* Category Transactions Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card rounded-xl border shadow-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">{selectedCategory} Expenses ({format(new Date(selectedMonth + "-01T00:00:00"), "MMMM yyyy")})</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transactions.filter(tx => tx.category === selectedCategory).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions for this category in the selected month.</p>
              ) : (
                transactions.filter(tx => tx.category === selectedCategory).map(tx => (
                  <div 
                    key={tx.SK} 
                    className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.date || tx.createdAt), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{tx.amount.toFixed(2)}</p>
                      {tx.splits?.[currentUserId || ""] > 0 ? (
                        <p className="text-xs text-muted-foreground">My share: ₹{tx.splits[currentUserId || ""].toFixed(2)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No share</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetailsModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
          householdId={activeHousehold?.householdId || ""}
          onDelete={() => {
            mutateTx((prev: any[] | undefined) => prev ? prev.filter(t => t.SK !== selectedTransaction.SK) : []);
            setSelectedTransaction(null);
          }}
          onUpdate={(updatedTx) => {
            setSelectedTransaction(updatedTx);
            mutateTx((prev: any[] | undefined) => prev ? prev.map(t => t.id === updatedTx.id ? updatedTx : t) : []);
          }}
        />
      )}
    </div>
  );
}
