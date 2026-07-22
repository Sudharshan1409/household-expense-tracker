"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { KPICard } from "@/components/ui/kpi-card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchAuthSession } from "aws-amplify/auth";
import { getRecentTransactions } from "@/actions/transaction";
import { subMonths, isAfter, startOfMonth } from "date-fns";

export default function SavingsPage() {
  const { activeHousehold, members, isLoading: isHouseholdLoading } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
          // Fetch up to 10000 transactions for all time without a month filter
          const allTx = await getRecentTransactions(token, activeHousehold.householdId, 10000);
          setTransactions(allTx);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeHousehold?.householdId]);

  if (isHouseholdLoading || isLoading) {
    return <PageLoader title="Loading savings data..." />;
  }

  // Define Date Ranges
  const now = new Date();
  
  const ranges = [
    { label: "This Month", startDate: startOfMonth(now) },
    { label: "Quarterly (Last 3 Months)", startDate: subMonths(now, 3) },
    { label: "Last Six Months", startDate: subMonths(now, 6) },
    { label: "Last 1 Year", startDate: subMonths(now, 12) },
    { label: "From Start (All Time)", startDate: new Date("2000-01-01") },
  ];

  // Calculate metrics for a specific range
  const calculateMetrics = (startDate: Date) => {
    const rangeTxs = transactions.filter(tx => {
      const txDate = new Date(tx.date || tx.createdAt);
      return isAfter(txDate, startDate);
    });

    const expenseTxs = rangeTxs.filter(tx => tx.transactionType !== "INCOME");
    const incomeTxs = rangeTxs.filter(tx => tx.transactionType === "INCOME");

    const mySpend = expenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
    const myIncome = incomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0);
    const mySavings = myIncome - mySpend;
    const savingsRate = myIncome > 0 ? (mySavings / myIncome) * 100 : 0;

    return { mySpend, myIncome, mySavings, savingsRate, count: rangeTxs.length };
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Savings Monitoring</h1>
          <p className="text-muted-foreground">
            Track your cash flow and net savings across different time ranges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="space-y-10">
        {ranges.map((range) => {
          const metrics = calculateMetrics(range.startDate);
          
          return (
            <div key={range.label} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-xl font-semibold tracking-tight">{range.label}</h2>
                <span className="text-sm text-muted-foreground">{metrics.count} transactions</span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Total Income"
                  value={`₹${metrics.myIncome.toFixed(2)}`}
                  description="Money earned"
                />
                <KPICard
                  title="Total Spend"
                  value={`₹${metrics.mySpend.toFixed(2)}`}
                  description="Money spent"
                />
                <KPICard
                  title="Net Savings"
                  value={`₹${metrics.mySavings.toFixed(2)}`}
                  description="Income minus expenses"
                  trend={{ 
                    value: metrics.mySavings >= 0 ? "Positive Cash Flow" : "Negative Cash Flow", 
                    label: "status", 
                    isPositive: metrics.mySavings >= 0 
                  }}
                />
                <KPICard
                  title="Savings Rate"
                  value={`${metrics.savingsRate.toFixed(1)}%`}
                  description="Percentage of income saved"
                  trend={{ 
                    value: metrics.savingsRate > 20 ? "Excellent" : metrics.savingsRate > 0 ? "Good" : "Needs Attention", 
                    label: "rating", 
                    isPositive: metrics.savingsRate > 0 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
