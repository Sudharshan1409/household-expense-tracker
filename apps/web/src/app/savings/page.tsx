"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { KPICard } from "@/components/ui/kpi-card";
import { Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, Target, ShieldCheck, AlertTriangle, TrendingUp, Landmark, CalendarDays, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageLoader } from "@/components/ui/page-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthSWR } from "@/hooks/use-auth-swr";
import { getTransactionsFromDate } from "@/actions/transaction";
import { subMonths, startOfMonth } from "date-fns";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2, Zap } from "lucide-react";

const formatINR = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function SavingsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();

  const now = new Date();
  
  const RANGES = [
    { label: "This Month", value: "month", startDate: startOfMonth(now) },
    { label: "Quarterly (Last 3 Months)", value: "quarter", startDate: subMonths(now, 3) },
    { label: "Last Six Months", value: "six_months", startDate: subMonths(now, 6) },
    { label: "Last 1 Year", value: "year", startDate: subMonths(now, 12) },
    { label: "From Start (All Time)", value: "all", startDate: new Date("2000-01-01") },
  ];

  const [selectedRangeValue, setSelectedRangeValue] = useState(RANGES[0].value);
  const [viewMode, setViewMode] = useState<"individual" | "household">("individual");

  const range = RANGES.find(r => r.value === selectedRangeValue) || RANGES[0];

  const { data: transactions = [], isLoading } = useAuthSWR(
    getTransactionsFromDate,
    activeHousehold?.householdId,
    [range.startDate.toISOString()]
  );

  const [individualGoal, setIndividualGoal] = useState({ name: "Personal Milestone", amount: 500000 });
  const [householdGoal, setHouseholdGoal] = useState({ name: "Household Milestone", amount: 1000000 });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoalName, setTempGoalName] = useState("");
  const [tempGoalAmount, setTempGoalAmount] = useState("");

  useEffect(() => {
    if (activeHousehold?.householdId && currentUserId) {
      const indKey = `savings_goal_${activeHousehold.householdId}_${currentUserId}`;
      const hhKey = `savings_goal_${activeHousehold.householdId}_household`;
      
      const savedInd = localStorage.getItem(indKey);
      if (savedInd) setIndividualGoal(JSON.parse(savedInd));
      
      const savedHh = localStorage.getItem(hhKey);
      if (savedHh) setHouseholdGoal(JSON.parse(savedHh));
    }
  }, [activeHousehold?.householdId, currentUserId]);

  const handleEditGoal = () => {
    const currentGoal = viewMode === "individual" ? individualGoal : householdGoal;
    setTempGoalName(currentGoal.name);
    setTempGoalAmount(currentGoal.amount.toString());
    setIsEditingGoal(true);
  };

  const saveGoal = () => {
    if (!tempGoalName || !tempGoalAmount) return;
    const amt = parseInt(tempGoalAmount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(amt) || amt <= 0) return;

    const newGoal = { name: tempGoalName, amount: amt };
    if (viewMode === "individual") {
      setIndividualGoal(newGoal);
      localStorage.setItem(`savings_goal_${activeHousehold?.householdId}_${currentUserId}`, JSON.stringify(newGoal));
    } else {
      setHouseholdGoal(newGoal);
      localStorage.setItem(`savings_goal_${activeHousehold?.householdId}_household`, JSON.stringify(newGoal));
    }
    setIsEditingGoal(false);
  };

  if (isHouseholdLoading) {
    return <PageLoader title="Loading savings data..." />;
  }

  // Calculate metrics for the loaded transactions
  const expenseTxs = transactions.filter(tx => tx.transactionType !== "INCOME");
  const incomeTxs = transactions.filter(tx => tx.transactionType === "INCOME");

  const mySpend = viewMode === "individual"
    ? expenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0)
    : expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);

  const myIncome = viewMode === "individual"
    ? incomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0)
    : incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);

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
      monthlyDataMap[monthKey].income += viewMode === "individual" 
        ? (myShare || (tx.paidBy === currentUserId ? tx.amount : 0)) 
        : tx.amount;
    } else {
      monthlyDataMap[monthKey].spend += viewMode === "individual" ? myShare : tx.amount;
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

  // 3. Savings Goal Tracker
  const currentGoal = viewMode === "individual" ? individualGoal : householdGoal;
  const goalProgress = Math.min((Math.max(mySavings, 0) / currentGoal.amount) * 100, 100);

  // 4. Emergency Runway Calculator
  const avgMonthlySpend = monthsInPeriod > 0 ? mySpend / monthsInPeriod : mySpend;
  const emergencyRunwayMonths = avgMonthlySpend > 0 ? mySavings / avgMonthlySpend : 0;

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex bg-muted/50 p-1 rounded-lg border">
            <button
              onClick={() => setViewMode("individual")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "individual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Share
            </button>
            <button
              onClick={() => setViewMode("household")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "household"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Household Total
            </button>
          </div>
          <Select 
            value={selectedRangeValue} 
            onValueChange={(val) => setSelectedRangeValue(val as string)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Range">
                {RANGES.find(r => r.value === selectedRangeValue)?.label || "Select Range"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HouseholdSwitcher />
        </div>
      </div>

      {isLoading ? (
        <PageLoader title="Fetching range data..." />
      ) : (
        <motion.div 
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
        >
          <motion.div 
            className="flex items-center justify-between border-b pb-2"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
            }}
          >
            <h2 className="text-xl font-semibold tracking-tight">{currentRangeLabel}</h2>
            <span className="text-sm text-muted-foreground">{transactions.length} transactions</span>
          </motion.div>
          
          {/* Premium Unified Savings Card */}
          <motion.div 
            className="relative overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-sm"
            variants={{
              hidden: { opacity: 0, y: 20, scale: 0.98 },
              visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
            }}
          >
            {/* Background decorative elements */}
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
            <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl"></div>
            
            <div className="relative p-6 sm:p-10">
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
                
                {/* Left Side: Main Savings Focus (Takes 2 cols on lg) */}
                <div className="lg:col-span-2 flex flex-col justify-center space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1.5 text-sm font-medium w-fit backdrop-blur-sm">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span>{viewMode === "individual" ? "Net Savings Vault" : "Household Savings Vault"}</span>
                  </div>
                  
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-5xl font-black tracking-tighter">
                        <AnimatedNumber value={mySavings} format={formatINR} />
                      </h2>
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
                      <div className="text-3xl font-bold tracking-tight">
                        <AnimatedNumber value={savingsRate} format={(v) => `${v.toFixed(1)}%`} />
                      </div>
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
                      <div className="text-2xl font-bold tracking-tight">
                        <AnimatedNumber value={myIncome} format={formatINR} />
                      </div>
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
                      <div className="text-2xl font-bold tracking-tight">
                        <AnimatedNumber value={mySpend} format={formatINR} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Money spent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Savings Growth Over Time */}
            <motion.div 
              className="rounded-xl border bg-card p-6 shadow-sm md:col-span-2"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
              }}
            >
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
            </motion.div>

            {/* Right Column: Projections & Goals */}
            <div className="flex flex-col gap-6">
              
              {/* Projected Annual Savings */}
              <motion.div 
                className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-center relative overflow-hidden"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                }}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CalendarDays className="h-24 w-24" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <CalendarDays className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold tracking-tight">Projected Annual</h2>
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    <AnimatedNumber value={projectedAnnualSavings} format={formatINR} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Based on your current habits, this is how much you are on track to save in a full year.
                  </p>
                </div>
              </motion.div>

              {/* Savings Goal Tracker */}
              <motion.div 
                className="rounded-xl border bg-card p-6 shadow-sm flex-1 flex flex-col justify-center relative group"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                }}
              >
                {!isEditingGoal ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        <h2 className="text-lg font-semibold tracking-tight">{currentGoal.name}</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          {goalProgress.toFixed(0)}%
                        </span>
                        <button 
                          onClick={handleEditGoal}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                          title="Edit Goal"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                        <motion.div 
                          className="h-full bg-emerald-500 rounded-full" 
                          initial={{ width: 0 }}
                          animate={{ width: `${goalProgress}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          ₹{Math.max(mySavings, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-muted-foreground">
                          Target: ₹{currentGoal.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      {goalProgress >= 100 
                        ? "Goal Achieved! Time to set a new target. 🎉"
                        : `You are tracking towards your ${currentGoal.name} milestone. Keep it up!`}
                    </p>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-amber-500" />
                      <h2 className="text-lg font-semibold tracking-tight">Edit Goal</h2>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Goal Name</label>
                        <input 
                          value={tempGoalName} 
                          onChange={(e) => setTempGoalName(e.target.value)} 
                          placeholder="e.g., Europe Trip" 
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Target Amount (₹)</label>
                        <input 
                          value={tempGoalAmount} 
                          onChange={(e) => setTempGoalAmount(e.target.value)} 
                          placeholder="500000" 
                          type="number"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" onClick={saveGoal} className="w-full gap-1">
                          <Check className="h-4 w-4" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingGoal(false)} className="w-full gap-1">
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Emergency Runway Calculator */}
              <motion.div 
                className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-center relative overflow-hidden"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                }}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Zap className="h-24 w-24" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <ShieldCheck className="h-5 w-5 text-purple-500" />
                  <h2 className="text-lg font-semibold tracking-tight">Emergency Runway</h2>
                </div>
                <div className="relative z-10">
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                      {Math.max(0, emergencyRunwayMonths).toFixed(1)}
                    </div>
                    <span className="text-xl font-semibold text-muted-foreground">Months</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    If your income stopped today, your current savings could fund your exact lifestyle for this long.
                  </p>
                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
