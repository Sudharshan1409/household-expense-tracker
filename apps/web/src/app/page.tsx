"use client";

import { useEffect, useState } from "react";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, IndianRupee } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getRecentTransactions } from "@/actions/transaction";
import { AddExpenseModal } from "@/components/transactions/add-expense-modal";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";

export default function Dashboard() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Default to current month in IST
  const getISTMonthString = () => {
    const now = new Date();
    // adjust to IST just for the month string
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  const loadTransactions = async () => {
    if (!activeHousehold?.householdId) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 100, selectedMonth);
        setTransactions(recentTx);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [activeHousehold?.householdId, selectedMonth]);

  if (isHouseholdLoading) {
    return <div className="animate-pulse space-y-6"><div className="h-10 w-1/3 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;
  }

  // Calculate metrics
  const myBudget = activeHousehold?.monthlyBudget;
  const expenseTxs = transactions.filter(tx => tx.transactionType !== "INCOME");
  const incomeTxs = transactions.filter(tx => tx.transactionType === "INCOME");
  
  const totalSpend = expenseTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const mySpend = expenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  const myIncome = incomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0);
  const mySavings = myIncome - mySpend;

  const budgetRemaining = (myBudget || 0) - mySpend;
  const budgetProgress = myBudget ? Math.min((mySpend / myBudget) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Here's what's happening in your household.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
          <Button onClick={() => setIsModalOpen(true)} className="hidden sm:flex">
            <IndianRupee className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="My Income"
          value={`₹${myIncome.toFixed(2)}`}
          description="Your share of income this month"
          trend={{ value: mySavings >= 0 ? "Savings" : "Deficit", label: mySavings >= 0 ? "+ Savings" : "- Deficit", isPositive: mySavings >= 0 }}
        />
        <KPICard
          title="My Spend"
          value={`₹${mySpend.toFixed(2)}`}
          description="Your share of expenses"
        />
        <KPICard
          title="Total Household Spend"
          value={`₹${totalSpend.toFixed(2)}`}
          description="Total expenses across all members"
        />
        <KPICard
          title="Budget Remaining"
          value={`₹${Math.max(budgetRemaining, 0).toFixed(2)}`}
          description={myBudget ? `${budgetProgress.toFixed(0)}% used of ₹${myBudget}` : "No budget set"}
          trend={{ value: budgetRemaining < 0 ? `Over by ₹${Math.abs(budgetRemaining).toFixed(2)}` : "On track", label: "budget status", isPositive: budgetRemaining >= 0 }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Recent Transactions</h2>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            {transactions.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description={`You haven't recorded any expenses for ${selectedMonth}.`}
                actionLabel="Add your first expense"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/30 p-2 -mx-2 rounded-lg cursor-pointer transition-colors"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx.category} • {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="font-semibold">₹{tx.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeHousehold?.householdId && (
        <>
          <AddExpenseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            householdId={activeHousehold.householdId}
            onSuccess={loadTransactions}
          />
          <TransactionDetailsModal
            isOpen={!!selectedTx}
            onClose={() => setSelectedTx(null)}
            transaction={selectedTx}
            householdId={activeHousehold.householdId}
          />
        </>
      )}
    </div>
  );
}
