"use client";

import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/ui/month-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, IndianRupee, Home, Clock, Target } from "lucide-react";
import { useAuthSWR } from "@/hooks/use-auth-swr";
import { getRecentTransactions } from "@/actions/transaction";
import { AddExpenseModal, ScannedReceiptData } from "@/components/transactions/add-expense-modal";
import { ScanReceiptButton } from "@/components/transactions/scan-receipt-button";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger-animation";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ManageHouseholdModal } from "@/components/household/manage-household-modal";
import { PacingChart } from "@/components/dashboard/pacing-chart";
import { Settings as SettingsIcon, UserPlus, Link as LinkIcon } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { format } from "date-fns";
import { toast } from "sonner";

const formatINR = (val: number) => {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
};

export default function Dashboard() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // Default to current month in IST
  const getISTMonthString = () => {
    const now = new Date();
    // adjust to IST just for the month string
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  // Calculate previous month string
  const [year, month] = selectedMonth.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthString = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  const { data: transactions = [], isLoading: isTxLoading, mutate: mutateTx } = useAuthSWR(
    getRecentTransactions,
    activeHousehold?.householdId,
    [1000, selectedMonth]
  );

  const { data: prevTransactions = [], isLoading: isPrevTxLoading, mutate: mutatePrevTx } = useAuthSWR(
    getRecentTransactions,
    activeHousehold?.householdId,
    [1000, prevMonthString]
  );

  const isLoadingTx = isTxLoading || isPrevTxLoading;

  const handleTransactionSuccess = () => {
    mutateTx();
    mutatePrevTx();
  };

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
                  className="h-10 w-10 text-muted-foreground hover:text-primary shrink-0 flex"
                  onClick={() => {
                    const inviteLink = `${window.location.origin}/invite/${activeHousehold.householdId}`;
                    navigator.clipboard.writeText(inviteLink);
                    toast("Invite link copied to clipboard!");
                  }}
                  title="Copy Invite Link"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 text-muted-foreground hover:text-primary shrink-0 flex"
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
          
          <ScanReceiptButton
            onScanSuccess={(data) => {
              setScannedData(data);
              setIsModalOpen(true);
            }}
            className="hidden sm:flex ml-2"
          />
          <Button
            onClick={() => {
              setScannedData(null);
              setIsModalOpen(true);
            }}
            className="hidden sm:flex ml-2 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <IndianRupee className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 relative z-10" />
            <span className="relative z-10">Add Expense</span>
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <MonthPicker 
          value={selectedMonth} 
          onChange={(val) => setSelectedMonth(val)}
          className="w-[180px]"
        />
      </div>

      <div className="space-y-4">
        {/* Hero Banner Card */}
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Home className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Total Household Spend</h3>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                {format(new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]) - 1), "MMM yyyy")}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                <AnimatedNumber value={totalSpend} format={formatINR} />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {spendDiff !== 0 ? (
                  <span className={`inline-flex items-center font-semibold ${spendDiff <= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {spendDiff > 0 ? "+" : "-"}{Math.abs(spendDiff).toFixed(1)}%
                  </span>
                ) : (
                  <span className="font-semibold text-muted-foreground">+0%</span>
                )}{" "}
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Your Share:</span>
                <span className="font-bold text-foreground">
                  <AnimatedNumber value={mySpend} format={formatINR} />
                </span>
                {totalSpend > 0 && (
                  <span className="text-muted-foreground">({Math.round((mySpend / totalSpend) * 100)}% of total)</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Your trend:</span>
                {mySpendDiff !== 0 ? (
                  <span className={`font-medium ${mySpendDiff <= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {mySpendDiff > 0 ? "+" : "-"}{Math.abs(mySpendDiff).toFixed(1)}%
                  </span>
                ) : (
                  <span className="font-medium">same as last month</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Compact 2-Column Row */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col justify-between space-y-2 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Daily Avg</span>
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold">
                <AnimatedNumber value={avgDailySpend} format={formatINR} />
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                Based on {currentDay} day{currentDay === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col justify-between space-y-2 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Budget Left</span>
              <Target className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div>
              <div className={`text-lg sm:text-2xl font-bold ${budgetRemaining < 0 ? "text-destructive" : ""}`}>
                {myBudget ? <AnimatedNumber value={budgetRemaining} format={formatINR} /> : "Not set"}
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                {myBudget ? (
                  budgetRemaining < 0 ? (
                    <span className="text-destructive font-medium">Over by {formatINR(Math.abs(budgetRemaining))}</span>
                  ) : (
                    <span>{budgetProgress.toFixed(0)}% used of {formatINR(myBudget)}</span>
                  )
                ) : (
                  "Set in Budgets tab"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-spring-in" style={{ animationDelay: '100ms' }}>
        <PacingChart 
          transactions={transactions} 
          prevTransactions={prevTransactions} 
          budget={myBudget} 
          selectedMonth={selectedMonth} 
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
                  action={<Button onClick={() => setIsModalOpen(true)}>Add your first expense</Button>}
                />
              ) : (
                <StaggerContainer className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {transactions.slice(0, 50).map((tx) => (
                    <StaggerItem 
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
                    </StaggerItem>
                  ))}
                </StaggerContainer>
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
                <StaggerContainer className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {topExpenses.map((tx, idx) => (
                    <StaggerItem 
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
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeHousehold?.householdId && (
        <>
          <AddExpenseModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setScannedData(null);
            }}
            householdId={activeHousehold.householdId}
            onSuccess={() => {
              mutateTx();
              setScannedData(null);
            }}
            initialData={scannedData}
          />
          <TransactionDetailsModal
            isOpen={!!selectedTx}
            onClose={() => setSelectedTx(null)}
            transaction={selectedTx}
            householdId={activeHousehold.householdId}
            onDelete={handleTransactionSuccess}
            onUpdate={(updatedTx) => {
              setSelectedTx(updatedTx);
              mutateTx((prev: any[] | undefined) => prev ? prev.map(t => t.id === updatedTx.id ? updatedTx : t) : []);
            }}
          />
          <ManageHouseholdModal
            isOpen={isManageModalOpen}
            onClose={() => setIsManageModalOpen(false)}
            household={activeHousehold}
            onSuccess={() => setIsManageModalOpen(false)}
          />
          
          {/* Mobile FABs for Scan and Add Expense */}
          <div className="md:hidden fixed bottom-20 right-4 z-40 flex flex-col gap-3 items-end">
            <ScanReceiptButton
              onScanSuccess={(data) => {
                setScannedData(data);
                setIsModalOpen(true);
              }}
              className="rounded-full shadow-xl border border-purple-500/40 px-4 py-2.5 bg-background/95 backdrop-blur-md text-xs font-bold"
            />
            <button
              onClick={() => {
                setScannedData(null);
                setIsModalOpen(true);
              }}
              className="group flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 font-bold text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--primary),0.6)] active:scale-95 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <div className="absolute inset-0 animate-ping opacity-20 bg-white rounded-2xl" />
              <IndianRupee className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 relative z-10" />
              <span className="relative z-10">Add Expense</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
