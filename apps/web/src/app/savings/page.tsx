"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { KPICard } from "@/components/ui/kpi-card";
import { Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, Target, ShieldCheck, AlertTriangle, TrendingUp, Landmark, CalendarDays, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  
  // 1. Group by Month for the Area Chart
  const monthlyDataMap: Record<string, { income: number; spend: number }> = {};
  
  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyDataMap[monthKey]) {
      monthlyDataMap[monthKey] = { income: 0, spend: 0 };
    }
    
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    
    if (tx.transactionType === "INCOME") {
      monthlyDataMap[monthKey].income += (myShare || (tx.paidBy === currentUserId ? tx.amount : 0));
    } else {
      monthlyDataMap[monthKey].spend += myShare;
    }
  });

  const savingsOverTimeData = Object.entries(monthlyDataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      savings: data.income - data.spend,
    }));

  // 2. Projected Annual Savings
  let monthsInPeriod = 1;
  if (selectedRangeValue === "quarter") monthsInPeriod = 3;
  if (selectedRangeValue === "six_months") monthsInPeriod = 6;
  if (selectedRangeValue === "year") monthsInPeriod = 12;
  if (selectedRangeValue === "all") monthsInPeriod = 12; // Fallback estimate
  
  const projectedAnnualSavings = (mySavings / monthsInPeriod) * 12;

  // 3. Savings Goal Tracker (Mock goal of 5 Lakhs for demonstration)
  const SAVINGS_GOAL = 500000; 
  const goalProgress = Math.min((Math.max(mySavings, 0) / SAVINGS_GOAL) * 100, 100);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-sm">
          <p className="mb-2 font-medium">{label}</p>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-primary font-semibold">
              Net Savings: ₹{payload[0].value.toFixed(2)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

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
          
          {/* Premium Unified Savings Card */}
          <div className="relative overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-sm">
            {/* Background decorative elements */}
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
            <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl"></div>
            
            <div className="relative p-6 sm:p-10">
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
                
                {/* Left Side: Main Savings Focus (Takes 2 cols on lg) */}
                <div className="lg:col-span-2 flex flex-col justify-center space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1.5 text-sm font-medium w-fit backdrop-blur-sm">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span>Net Savings Vault</span>
                  </div>
                  
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-5xl font-black tracking-tighter">₹{mySavings.toFixed(2)}</h2>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Total money saved in this period
                    </p>
                  </div>

                  <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                    savingsRate > 20 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                    savingsRate > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                    "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>
                    {savingsRate > 20 ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : savingsRate > 0 ? (
                      <Target className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <span>
                      {savingsRate > 20 ? "Excellent Saving Habits" : 
                       savingsRate > 0 ? "On Track, but can improve" : 
                       "Negative Cash Flow - Needs Attention"}
                    </span>
                  </div>
                </div>

                {/* Right Side: Detailed Breakdown (Takes 3 cols on lg) */}
                <div className="lg:col-span-3 grid gap-4 sm:grid-cols-3">
                  
                  {/* Savings Rate Card */}
                  <div className="flex flex-col justify-between rounded-2xl bg-muted/30 border border-muted/50 p-5">
                    <div className="flex items-center gap-2 text-primary">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <PiggyBank className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold">Savings Rate</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-bold tracking-tight">{savingsRate.toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground mt-1">% of income saved</p>
                    </div>
                  </div>

                  {/* Income Card */}
                  <div className="flex flex-col justify-between rounded-2xl bg-muted/30 border border-muted/50 p-5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <ArrowDownRight className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold">Total Income</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-2xl font-bold tracking-tight">₹{myIncome.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Money earned</p>
                    </div>
                  </div>

                  {/* Spend Card */}
                  <div className="flex flex-col justify-between rounded-2xl bg-muted/30 border border-muted/50 p-5">
                    <div className="flex items-center gap-2 text-destructive">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold">Total Spend</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-2xl font-bold tracking-tight">₹{mySpend.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Money spent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Savings Growth Over Time */}
            <div className="rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">Savings Growth Over Time</h2>
              </div>
              <div className="h-[300px] w-full">
                {savingsOverTimeData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                    <TrendingUp className="h-8 w-8 opacity-20" />
                    No data available for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsOverTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickFormatter={(val) => `₹${val}`}
                        dx={-10}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="savings" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSavings)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right Column: Projections & Goals */}
            <div className="flex flex-col gap-6">
              
              {/* Projected Annual Savings */}
              <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CalendarDays className="h-24 w-24" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <CalendarDays className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold tracking-tight">Projected Annual</h2>
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    ₹{projectedAnnualSavings.toFixed(0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Based on your current habits, this is how much you are on track to save in a full year.
                  </p>
                </div>
              </div>

              {/* Savings Goal Tracker */}
              <div className="rounded-xl border bg-card p-6 shadow-sm flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-semibold tracking-tight">Milestone Goal</h2>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {goalProgress.toFixed(0)}%
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 ease-in-out" 
                      style={{ width: `${goalProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      ₹{Math.max(mySavings, 0).toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">
                      Target: ₹{SAVINGS_GOAL.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  You are tracking towards your ₹5 Lakh savings milestone. Keep it up!
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
