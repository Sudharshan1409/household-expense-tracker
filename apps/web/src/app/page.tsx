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
import { ManageHouseholdModal } from "@/components/household/manage-household-modal";
import { Settings as SettingsIcon, UserPlus, Link as LinkIcon } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { format } from "date-fns";

export default function Dashboard() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(true);

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
    setIsLoadingTx(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, selectedMonth);
        setTransactions(recentTx);

        // Fetch previous month
        const [year, month] = selectedMonth.split("-").map(Number);
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthString = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
        const prevTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, prevMonthString);
        setPrevTransactions(prevTx);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTx(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [activeHousehold?.householdId, selectedMonth]);

  if (isHouseholdLoading || isLoadingTx) {
    return <PageLoader title="Loading overview..." />;
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

  // Previous Month metrics
  const prevExpenseTxs = prevTransactions.filter(tx => tx.transactionType !== "INCOME");
  const prevTotalSpend = prevExpenseTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const prevMySpend = prevExpenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  
  // MoM calculations
  const spendDiff = prevTotalSpend > 0 ? ((totalSpend - prevTotalSpend) / prevTotalSpend) * 100 : 0;
  const mySpendDiff = prevMySpend > 0 ? ((mySpend - prevMySpend) / prevMySpend) * 100 : 0;

  // Average Daily Spend
  const daysInMonth = new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate();
  const currentDay = selectedMonth === getISTMonthString() ? new Date().getDate() : daysInMonth;
  const avgDailySpend = currentDay > 0 ? totalSpend / currentDay : 0;

  // Top 10 Expenses
  const topExpenses = [...expenseTxs].sort((a, b) => b.amount - a.amount).slice(0, 10);

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
        <div className="flex items-center gap-2">
          {activeHousehold && (
            <>
              {(activeHousehold.role === "OWNER" || activeHousehold.role === "ADMIN") && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-10 w-10 text-muted-foreground hover:text-primary shrink-0 hidden sm:flex"
                  onClick={() => {
                    const inviteLink = `${window.location.origin}/invite/${activeHousehold.householdId}`;
                    navigator.clipboard.writeText(inviteLink);
                    alert("Invite link copied to clipboard!");
                  }}
                  title="Copy Invite Link"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 text-muted-foreground hover:text-primary shrink-0 hidden sm:flex"
                onClick={() => setIsManageModalOpen(true)}
                title="Manage Household"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </>
          )}
          
          <div className="mx-1">
            <HouseholdSwitcher />
          </div>
          
          <Button onClick={() => setIsModalOpen(true)} className="hidden sm:flex ml-2">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          title="Total Household Spend"
          value={`₹${totalSpend.toFixed(2)}`}
          description="Total expenses across all members"
          trend={{ 
            value: spendDiff !== 0 ? `${spendDiff > 0 ? "+" : "-"}${Math.abs(spendDiff).toFixed(1)}%` : "+0%", 
            label: spendDiff > 0 ? "vs last month" : "vs last month", 
            isPositive: spendDiff <= 0 // less spend is positive
          }}
        />
        <KPICard
          title="My Spend"
          value={`₹${mySpend.toFixed(2)}`}
          description="Your share of expenses"
          trend={{ 
            value: mySpendDiff !== 0 ? `${mySpendDiff > 0 ? "+" : "-"}${Math.abs(mySpendDiff).toFixed(1)}%` : "+0%", 
            label: mySpendDiff > 0 ? "vs last month" : "vs last month", 
            isPositive: mySpendDiff <= 0 
          }}
        />
        <KPICard
          title="My Total Income"
          value={`₹${myIncome.toFixed(2)}`}
          description="Your logged income"
        />
        <KPICard
          title="My Savings"
          value={`₹${mySavings.toFixed(2)}`}
          description="Income minus your spend"
          trend={{ 
            value: mySavings >= 0 ? "Positive" : "Negative", 
            label: "cash flow", 
            isPositive: mySavings >= 0 
          }}
        />
        <KPICard
          title="Average Daily Spend"
          value={`₹${avgDailySpend.toFixed(2)}`}
          description={`Based on ${currentDay} days`}
        />
        <KPICard
          title="Budget Remaining"
          value={`₹${Math.max(budgetRemaining, 0).toFixed(2)}`}
          description={myBudget ? `${budgetProgress.toFixed(0)}% used of ₹${myBudget}` : "No budget set"}
          trend={{ value: budgetRemaining < 0 ? `Over by ₹${Math.abs(budgetRemaining).toFixed(2)}` : "On track", label: "budget status", isPositive: budgetRemaining >= 0 }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                  {transactions.slice(0, 50).map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/30 p-2 -mx-2 rounded-lg cursor-pointer transition-colors"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <div>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.category} • {format(new Date(tx.date || tx.createdAt), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="font-semibold text-right">
                        <div className={tx.transactionType === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : ""}>
                          {tx.transactionType === "INCOME" ? "+" : ""}₹{tx.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Top 10 Expenses</h2>
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              {topExpenses.length === 0 ? (
                <EmptyState
                  title="No expenses yet"
                  description={`No high-value expenses found for ${selectedMonth}.`}
                />
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {topExpenses.map((tx, idx) => (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/30 p-2 -mx-2 rounded-lg cursor-pointer transition-colors"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {tx.category}
                          </p>
                        </div>
                      </div>
                      <div className="font-semibold">₹{tx.amount.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            onDelete={loadTransactions}
          />
          <ManageHouseholdModal
            isOpen={isManageModalOpen}
            onClose={() => setIsManageModalOpen(false)}
            household={activeHousehold}
            onSuccess={() => setIsManageModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
