"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { KPICard } from "@/components/ui/kpi-card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchAuthSession } from "aws-amplify/auth";
import { getTransactionsFromDate } from "@/actions/transaction";
import { subMonths, startOfMonth } from "date-fns";

export default function SavingsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const now = new Date();
  
  const RANGES = [
    { label: "This Month", value: "month", startDate: startOfMonth(now) },
    { label: "Quarterly (Last 3 Months)", value: "quarter", startDate: subMonths(now, 3) },
    { label: "Last Six Months", value: "six_months", startDate: subMonths(now, 6) },
    { label: "Last 1 Year", value: "year", startDate: subMonths(now, 12) },
    { label: "From Start (All Time)", value: "all", startDate: new Date("2000-01-01") },
  ];

  const [selectedRangeValue, setSelectedRangeValue] = useState(RANGES[0].value);

  useEffect(() => {
    async function loadData() {
      if (!activeHousehold?.householdId) return;
      setIsLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const userSub = session.userSub;
        if (token && userSub) {
          setCurrentUserId(userSub);
          
          const range = RANGES.find(r => r.value === selectedRangeValue) || RANGES[0];
          
          const txs = await getTransactionsFromDate(token, activeHousehold.householdId, range.startDate.toISOString());
          setTransactions(txs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeHousehold?.householdId, selectedRangeValue]);

  if (isHouseholdLoading) {
    return <PageLoader title="Loading savings data..." />;
  }

  // Calculate metrics for the loaded transactions
  const expenseTxs = transactions.filter(tx => tx.transactionType !== "INCOME");
  const incomeTxs = transactions.filter(tx => tx.transactionType === "INCOME");

  const mySpend = expenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  const myIncome = incomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0);
  const mySavings = myIncome - mySpend;
  const savingsRate = myIncome > 0 ? (mySavings / myIncome) * 100 : 0;
  
  const currentRangeLabel = RANGES.find(r => r.value === selectedRangeValue)?.label;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Savings Monitoring</h1>
          <p className="text-muted-foreground">
            Track your cash flow and net savings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="flex h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={selectedRangeValue}
            onChange={(e) => setSelectedRangeValue(e.target.value)}
            disabled={isLoading}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <HouseholdSwitcher />
        </div>
      </div>

      {isLoading ? (
        <PageLoader title="Fetching range data..." />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xl font-semibold tracking-tight">{currentRangeLabel}</h2>
            <span className="text-sm text-muted-foreground">{transactions.length} transactions</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Income"
              value={`₹${myIncome.toFixed(2)}`}
              description="Money earned"
            />
            <KPICard
              title="Total Spend"
              value={`₹${mySpend.toFixed(2)}`}
              description="Money spent"
            />
            <KPICard
              title="Net Savings"
              value={`₹${mySavings.toFixed(2)}`}
              description="Income minus expenses"
              trend={{ 
                value: mySavings >= 0 ? "Positive Cash Flow" : "Negative Cash Flow", 
                label: "status", 
                isPositive: mySavings >= 0 
              }}
            />
            <KPICard
              title="Savings Rate"
              value={`${savingsRate.toFixed(1)}%`}
              description="Percentage of income saved"
              trend={{ 
                value: savingsRate > 20 ? "Excellent" : savingsRate > 0 ? "Good" : "Needs Attention", 
                label: "rating", 
                isPositive: savingsRate > 0 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
