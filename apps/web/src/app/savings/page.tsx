"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { KPICard } from "@/components/ui/kpi-card";
import { Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, Target, ShieldCheck, AlertTriangle, TrendingUp, Landmark, CalendarDays, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageLoader } from "@/components/ui/page-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthSWR } from "@/hooks/use-auth-swr";
import { getTransactionsFromDate, getMonthlySummaries } from "@/actions/transaction";
import { getHouseholdMembers, updateSavingsData } from "@/actions/household";
import { subMonths, startOfMonth, addMonths, addDays, isBefore, isSameMonth, isSameDay } from "date-fns";
import { fetchAuthSession } from "aws-amplify/auth";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2, Zap } from "lucide-react";
import confetti from "canvas-confetti";

const formatINR = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function SavingsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId, refreshHouseholds } = useHousehold();

  const RANGES = useMemo(() => {
    const now = new Date();
    return [
      { label: "This Month", value: "month", startDate: startOfMonth(now) },
      { label: "Quarterly (Last 3 Months)", value: "quarter", startDate: subMonths(now, 3) },
      { label: "Last Six Months", value: "six_months", startDate: subMonths(now, 6) },
      { label: "Last 1 Year", value: "year", startDate: subMonths(now, 12) },
      { label: "From Start (All Time)", value: "all", startDate: new Date("2000-01-01") },
    ];
  }, []);

  const [selectedRangeValue, setSelectedRangeValue] = useState(RANGES[0].value);
  const [viewMode, setViewMode] = useState<"individual" | "household">("individual");

  const range = RANGES.find(r => r.value === selectedRangeValue) || RANGES[0];

  const { data: summaries = [], isLoading: isSummariesLoading } = useAuthSWR(
    getMonthlySummaries,
    activeHousehold?.householdId
  );

  const { data: transactions = [], isLoading: isTransactionsLoading } = useAuthSWR(
    getTransactionsFromDate,
    selectedRangeValue === "month" ? activeHousehold?.householdId : null,
    [range.startDate.toISOString()]
  );
  
  const { data: members = [] } = useAuthSWR(
    getHouseholdMembers,
    activeHousehold?.householdId
  );
  
  const getMemberName = (uid: string) => {
    if (uid === currentUserId) return "Your";
    const member = members.find((m: any) => m.userId === uid);
    if (member?.userName) return `${member.userName}'s`;
    return "Member's";
  };

  type Goal = { id: string; name: string; amount: number; targetDate: string; type?: "mine" | "household" | "other"; ownerId?: string; allocated?: number };
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() + 1);
  const defaultDateString = defaultDate.toISOString().split("T")[0];

  const [individualGoals, setIndividualGoals] = useState<Goal[]>([]);
  const [pureHouseholdGoals, setPureHouseholdGoals] = useState<Goal[]>([]);
  const [allOtherIndividualGoals, setAllOtherIndividualGoals] = useState<Goal[]>([]);
  
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalType, setEditingGoalType] = useState<"mine" | "household" | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [tempGoalName, setTempGoalName] = useState("");
  const [tempGoalAmount, setTempGoalAmount] = useState("");
  const [tempGoalDate, setTempGoalDate] = useState("");
  const [completedGoals, setCompletedGoals] = useState<string[]>([]);

  const saveToDB = async (ind: Goal[], hh: Goal[], other: Goal[]) => {
    if (!activeHousehold?.householdId) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;
      const allGoals = [...ind, ...hh, ...other];
      await updateSavingsData(token, activeHousehold.householdId, allGoals);
      await refreshHouseholds();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeHousehold?.householdId && currentUserId) {
      const dbGoals: Goal[] = activeHousehold.metadata?.savingsGoals || [];
      
      const ind = dbGoals.filter(g => g.ownerId === currentUserId);
      const hh = dbGoals.filter(g => g.ownerId === "HOUSEHOLD");
      const others = dbGoals.filter(g => g.ownerId !== currentUserId && g.ownerId !== "HOUSEHOLD");
      
      setIndividualGoals(ind);
      setPureHouseholdGoals(hh);
      setAllOtherIndividualGoals(others);
    }
  }, [activeHousehold?.householdId, activeHousehold?.metadata, currentUserId]);

  const handleAddGoal = () => {
    setTempGoalName("");
    setTempGoalAmount("");
    setTempGoalDate(defaultDateString);
    setEditingGoalId("new");
    setEditingGoalType(viewMode === "individual" ? "mine" : "household");
  };

  const handleEditGoal = (goal: any) => {
    setTempGoalName(goal.name);
    setTempGoalAmount(goal.amount.toString());
    setTempGoalDate(goal.targetDate || defaultDateString);
    setEditingGoalId(goal.id);
    setEditingGoalType(goal.type);
  };
  
  const handleDeleteGoal = (goalId: string, goalType: string) => {
    if (goalType === "mine") {
      const newList = individualGoals.filter(g => g.id !== goalId);
      setIndividualGoals(newList);
      saveToDB(newList, pureHouseholdGoals, allOtherIndividualGoals);
    } else {
      const newList = pureHouseholdGoals.filter(g => g.id !== goalId);
      setPureHouseholdGoals(newList);
      saveToDB(individualGoals, newList, allOtherIndividualGoals);
    }
  };

  const handleCompleteGoal = (goalId: string, goalType: string) => {
    if (goalType === "mine") {
      const newList = individualGoals.filter(g => g.id !== goalId);
      saveToDB(newList, pureHouseholdGoals, allOtherIndividualGoals);
    } else {
      const newList = pureHouseholdGoals.filter(g => g.id !== goalId);
      saveToDB(individualGoals, newList, allOtherIndividualGoals);
    }
    
    setCompletedGoals(prev => [...prev, goalId]);
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const saveGoal = () => {
    if (!tempGoalName || !tempGoalAmount) return;
    const amt = parseInt(tempGoalAmount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(amt) || amt <= 0) return;

    let newList: Goal[];
    if (editingGoalType === "mine") {
      const currentList = individualGoals;
      if (editingGoalId === "new") {
        newList = [...currentList, { id: Date.now().toString(), name: tempGoalName, amount: amt, targetDate: tempGoalDate, ownerId: currentUserId || "" }];
      } else {
        newList = currentList.map(g => g.id === editingGoalId ? { ...g, name: tempGoalName, amount: amt, targetDate: tempGoalDate } : g);
      }
      setIndividualGoals(newList);
      saveToDB(newList, pureHouseholdGoals, allOtherIndividualGoals);
    } else {
      const currentList = pureHouseholdGoals;
      if (editingGoalId === "new") {
        newList = [...currentList, { id: Date.now().toString(), name: tempGoalName, amount: amt, targetDate: tempGoalDate, ownerId: "HOUSEHOLD" }];
      } else {
        newList = currentList.map(g => g.id === editingGoalId ? { ...g, name: tempGoalName, amount: amt, targetDate: tempGoalDate } : g);
      }
      setPureHouseholdGoals(newList);
      saveToDB(individualGoals, newList, allOtherIndividualGoals);
    }
    setEditingGoalId(null);
  };
  





  // Filter summaries based on selected range
  const filteredSummaries = useMemo(() => {
    if (selectedRangeValue === 'all') return summaries;
    return summaries.filter((s: any) => {
      const summaryDate = new Date(`${s.month}-01T00:00:00Z`);
      return summaryDate >= range.startDate;
    });
  }, [summaries, range.startDate, selectedRangeValue]);

  if (isHouseholdLoading) {
    return <PageLoader title="Loading savings data..." />;
  }


  // Calculate metrics
  let mySpend = 0;
  let myIncome = 0;
  const userSavingsMap: Record<string, number> = {};

  filteredSummaries.forEach((summary: any) => {
    const users = summary.users || {};
    
    // For envelope funding / goals
    for (const [uid, data] of Object.entries(users)) {
      const uData = data as any;
      const net = (uData.income || 0) - (uData.spend || 0);
      userSavingsMap[uid] = (userSavingsMap[uid] || 0) + net;
    }

    if (viewMode === "individual") {
      const myData = users[currentUserId || ""] || { income: 0, spend: 0 };
      myIncome += myData.income || 0;
      mySpend += myData.spend || 0;
    } else {
      for (const data of Object.values(users)) {
        const uData = data as any;
        myIncome += uData.income || 0;
        mySpend += uData.spend || 0;
      }
    }
  });

  const mySavings = myIncome - mySpend;
  const savingsRate = myIncome > 0 ? (mySavings / myIncome) * 100 : 0;
  
  // Graph generation
  let cumulativeSavings = 0;
  let savingsOverTimeData: any[] = [];

  if (selectedRangeValue === 'month') {
    // ----------------------------------------------------
    // DAY BY DAY LOGIC (Using raw transactions)
    // ----------------------------------------------------
    const dailyDataMap: Record<string, { income: number; spend: number }> = {};
    let cursor = new Date(range.startDate);
    const endCursor = new Date();
    
    while (isBefore(cursor, endCursor) || isSameDay(cursor, endCursor)) {
      const dayKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      dailyDataMap[dayKey] = { income: 0, spend: 0 };
      cursor = addDays(cursor, 1);
    }

    transactions.forEach((tx: any) => {
      const date = new Date(tx.date);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!dailyDataMap[dayKey]) dailyDataMap[dayKey] = { income: 0, spend: 0 };
      
      const myShare = tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId && (!tx.splits || Object.keys(tx.splits).length === 0) ? tx.amount : 0);
      
      if (tx.transactionType === "INCOME") {
        dailyDataMap[dayKey].income += viewMode === "individual" ? myShare : tx.amount;
      } else {
        dailyDataMap[dayKey].spend += viewMode === "individual" ? myShare : tx.amount;
      }
    });

    savingsOverTimeData = Object.entries(dailyDataMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => {
        cumulativeSavings += (data.income - data.spend);
        return {
          month: day.split('-').slice(1).join('/'), // e.g., "08/01"
          savings: cumulativeSavings,
        };
      });
  } else {
    // ----------------------------------------------------
    // MONTH BY MONTH LOGIC (Using Monthly Summaries)
    // ----------------------------------------------------
    const monthlyDataMap: Record<string, { income: number; spend: number }> = {};
    
    let cursor = new Date(range.startDate);
    const endCursor = new Date();
    if (selectedRangeValue !== 'all') {
      while (isBefore(cursor, endCursor) || isSameMonth(cursor, endCursor)) {
        const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        monthlyDataMap[monthKey] = { income: 0, spend: 0 };
        cursor = addMonths(cursor, 1);
      }
    }

    filteredSummaries.forEach((summary: any) => {
      const monthKey = summary.month;
      if (!monthlyDataMap[monthKey]) monthlyDataMap[monthKey] = { income: 0, spend: 0 };
      
      const users = summary.users || {};
      if (viewMode === "individual") {
        const myData = users[currentUserId || ""] || { income: 0, spend: 0 };
        monthlyDataMap[monthKey].income += myData.income || 0;
        monthlyDataMap[monthKey].spend += myData.spend || 0;
      } else {
        for (const data of Object.values(users)) {
          const uData = data as any;
          monthlyDataMap[monthKey].income += uData.income || 0;
          monthlyDataMap[monthKey].spend += uData.spend || 0;
        }
      }
    });

    savingsOverTimeData = Object.entries(monthlyDataMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        cumulativeSavings += (data.income - data.spend);
        return {
          month,
          savings: cumulativeSavings,
        };
      });
  }

  // 2. Projected Annual Savings
  let monthsInPeriod = 1;
  if (selectedRangeValue === "quarter") monthsInPeriod = 3;
  if (selectedRangeValue === "six_months") monthsInPeriod = 6;
  if (selectedRangeValue === "year") monthsInPeriod = 12;
  if (selectedRangeValue === "all") monthsInPeriod = 12; // Fallback estimate
  
  const projectedAnnualSavings = (mySavings / monthsInPeriod) * 12;

  const householdTracked = Object.values(userSavingsMap).reduce((sum, val) => sum + Math.max(0, val), 0);
  const totalTrackedSavings = viewMode === "individual" ? Math.max(mySavings, 0) : householdTracked;
  const overallSavings = totalTrackedSavings;

  // 3. Savings Goal Tracker (Sequential Funding)
  let currentGoalsList = [];
  if (viewMode === "individual") {
    currentGoalsList = individualGoals.map(g => ({ ...g, type: "mine" as const, ownerId: currentUserId }));
    currentGoalsList.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  } else {
    currentGoalsList = [
      ...pureHouseholdGoals.map(g => ({ ...g, type: "household" as const, ownerId: "" })),
      ...individualGoals.map(g => ({ ...g, type: "mine" as const, ownerId: currentUserId })),
      ...allOtherIndividualGoals.map(g => ({ ...g, type: "other" as const }))
    ];
    currentGoalsList.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  }
  const avgMonthlySavings = monthsInPeriod > 0 ? mySavings / monthsInPeriod : mySavings;

  // Calculate ALL TIME savings map specifically for milestone goals
  const allTimeUserSavingsMap: Record<string, number> = {};
  summaries.forEach((summary: any) => {
    const users = summary.users || {};
    for (const [uid, data] of Object.entries(users)) {
      const uData = data as any;
      const net = (uData.income || 0) - (uData.spend || 0);
      allTimeUserSavingsMap[uid] = (allTimeUserSavingsMap[uid] || 0) + net;
    }
  });

  // Initialize pools for envelope funding (using all time data)
  const userPools: Record<string, number> = {};
  for (const k in allTimeUserSavingsMap) {
    userPools[k] = Math.max(0, allTimeUserSavingsMap[k]);
  }
  
  const goalsWithProgress = currentGoalsList.map(goal => {
    let allocated = 0;
    const fundingSources: { name: string; amount: number }[] = [];
    
    if (viewMode === "individual") {
      // In individual mode, use single combined pool
      const individualPool = userPools[currentUserId || ""] || 0;
      const previouslyAllocated = currentGoalsList
        .slice(0, currentGoalsList.indexOf(goal))
        .reduce((sum, g) => sum + ((g as any).allocated || 0), 0);
      const available = Math.max(0, individualPool - previouslyAllocated);
      allocated = Math.min(available, goal.amount);
      if (allocated > 0) fundingSources.push({ name: "My Tracked Savings", amount: allocated });
      (goal as any).allocated = allocated;
    } else {
      // In household mode, strict pool rules apply
      let needed = goal.amount;
      
      if (goal.type === "mine" || goal.type === "other") {
        // Individual goals take from their specific owner's pool first
        const ownerId = goal.ownerId || currentUserId || "";
        const available = userPools[ownerId] || 0;
        let take = Math.min(available, needed);
        allocated += take;
        userPools[ownerId] -= take;
        needed -= take;
        if (take > 0) {
          fundingSources.push({ name: `${getMemberName(ownerId)} Tracked Savings`, amount: take });
        }
      } else {
        // Household goals drain from all personal pools
        for (const uid of Object.keys(userPools)) {
          if (needed <= 0) break;
          const available = userPools[uid] || 0;
          if (available > 0) {
            const take = Math.min(available, needed);
            allocated += take;
            userPools[uid] -= take;
            needed -= take;
            if (take > 0) {
              fundingSources.push({ name: `${getMemberName(uid)} Tracked Savings`, amount: take });
            }
          }
        }
      }
      (goal as any).allocated = allocated;
    }
    
    const isJustCompleted = completedGoals.includes(goal.id);
    let progress = Math.min((allocated / goal.amount) * 100, 100);
    
    let trackingMessage = "";
    let trackingColor = "text-muted-foreground";
    let requiredMonthlySavings = 0;
    
    if (isJustCompleted || progress >= 100) {
      trackingMessage = "Goal Achieved! 🎉";
      trackingColor = "text-emerald-500";
      progress = 100;
      if (isJustCompleted) allocated = goal.amount;
    } else {
      const target = new Date(goal.targetDate);
      const now = new Date();
      const monthsRemaining = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
      
      if (monthsRemaining > 0) {
        const amountRemaining = goal.amount - allocated;
        requiredMonthlySavings = amountRemaining / monthsRemaining;
        
        if (avgMonthlySavings >= requiredMonthlySavings) {
           trackingMessage = `On track! Keep saving ₹${requiredMonthlySavings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/mo.`;
           trackingColor = "text-emerald-500 dark:text-emerald-400";
        } else {
           trackingMessage = `Falling behind. Try to save ₹${requiredMonthlySavings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/mo.`;
           trackingColor = "text-amber-500 dark:text-amber-400";
        }
      } else {
        trackingMessage = "Target date has passed!";
        trackingColor = "text-red-500";
      }
    }
    
    return { ...goal, allocated, progress, trackingMessage, trackingColor, fundingSources, requiredMonthlySavings };
  });

  // 4. Emergency Runway Calculator
  const avgMonthlySpend = monthsInPeriod > 0 ? mySpend / monthsInPeriod : mySpend;
  const emergencyRunwayMonths = avgMonthlySpend > 0 ? overallSavings / avgMonthlySpend : 0;

  const renderEditGoalForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Award className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold tracking-tight">{editingGoalId === "new" ? "New Goal" : "Edit Goal"}</h2>
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
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="text-xs font-medium text-muted-foreground">Target Date</label>
            <input 
              value={tempGoalDate} 
              onChange={(e) => setTempGoalDate(e.target.value)} 
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={saveGoal} className="flex-1 gap-1">
            <Check className="h-4 w-4" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditingGoalId(null)} className="flex-1 gap-1">
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );

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
            disabled={isSummariesLoading}
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

      {isSummariesLoading ? (
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
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-5xl font-black tracking-tighter">
                        <AnimatedNumber key={selectedRangeValue} value={overallSavings} format={formatINR} />
                      </h2>
                    </div>
                    

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
                        <AnimatedNumber key={selectedRangeValue} value={savingsRate} format={(v) => `${v.toFixed(1)}%`} />
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
                        <AnimatedNumber key={selectedRangeValue} value={myIncome} format={formatINR} />
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
                        <AnimatedNumber key={selectedRangeValue} value={mySpend} format={formatINR} />
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
                {(selectedRangeValue === 'month' && isTransactionsLoading) ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    Loading daily insights...
                  </div>
                ) : savingsOverTimeData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                    <TrendingUp className="h-8 w-8 opacity-20" />
                    No data available for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsOverTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
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
                      <Area type="monotone" dataKey="savings" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorSavings)" strokeWidth={3} />
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
                    <AnimatedNumber key={selectedRangeValue} value={projectedAnnualSavings} format={formatINR} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Based on your current habits, this is how much you are on track to save in a full year.
                  </p>
                </div>
              </motion.div>

              {/* Savings Goals List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-lg font-semibold tracking-tight">Milestone Goals</h3>
                  <Button size="sm" variant="outline" onClick={handleAddGoal} className="h-8">
                    + Add Goal
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {goalsWithProgress.map(goal => (
                    <motion.div 
                      key={goal.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-border"
                      onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                    >
                      {(() => {
                        const isJustCompleted = completedGoals.includes(goal.id);
                        return editingGoalId !== goal.id ? (
                        <>
                          <div className="flex items-start justify-between mb-4 gap-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                              <Award className="h-5 w-5 text-amber-500 shrink-0" />
                              <h2 className="text-lg font-semibold tracking-tight break-words">{goal.name}</h2>
                              {viewMode === "household" && (
                                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full whitespace-nowrap shrink-0 ${
                                  goal.type === 'household' ? 'bg-blue-500/10 text-blue-600' :
                                  goal.type === 'mine' ? 'bg-purple-500/10 text-purple-600' :
                                  'bg-slate-500/10 text-slate-600'
                                }`}>
                                  {goal.type === 'household' ? 'Household' : goal.type === 'mine' ? 'My Goal' : 'Member Goal'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <span className="text-sm font-medium text-muted-foreground mr-1">
                                {goal.progress.toFixed(0)}%
                              </span>
                              {goal.type !== "other" && (
                                <>
                                  {!isJustCompleted && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleCompleteGoal(goal.id, goal.type as string); }}
                                      className="text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 p-1.5 rounded-md transition-colors mr-1"
                                      title="Mark as Completed"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditGoal(goal); }}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-md transition-colors"
                                    title="Edit Goal"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id, goal.type as string); }}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                                    title="Delete Goal"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                              <motion.div 
                                className="h-full bg-emerald-500 rounded-full" 
                                initial={{ width: 0 }}
                                animate={{ width: `${goal.progress}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                              />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                                ₹{(goal.allocated || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                Target: ₹{goal.amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                            
                            <p className={`mt-3 text-xs font-medium ${goal.trackingColor}`}>
                              {goal.trackingMessage}
                            </p>
                            
                            {expandedGoalId === goal.id && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: 'auto', opacity: 1 }}
                                className="mt-4 pt-4 border-t border-border space-y-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Target Date:</span>
                                    <span className="font-medium text-foreground">{new Date(goal.targetDate).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Required Pace:</span>
                                    <span className="font-medium text-foreground">₹{Math.round(goal.requiredMonthlySavings || 0).toLocaleString('en-IN')}/mo</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Current Savings Pace:</span>
                                    <span className="font-medium text-foreground">₹{Math.round(avgMonthlySavings).toLocaleString('en-IN')}/mo</span>
                                  </div>
                                </div>
                                
                                <div className="pt-2 border-t border-border/50">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Funding Breakdown</span>
                                  <div className="mt-2 space-y-1.5">
                                    {goal.fundingSources?.map((src: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground/80">{src.name}</span>
                                        <span className="font-medium text-foreground">₹{src.amount.toLocaleString('en-IN')}</span>
                                      </div>
                                    ))}
                                    {goal.fundingSources?.length === 0 && (
                                      <div className="text-xs text-muted-foreground italic">No funds allocated yet.</div>
                                    )}
                                    {goal.amount > (goal.allocated || 0) && (
                                      <div className="flex justify-between text-xs text-rose-500/90 pt-1 mt-1 border-t border-rose-500/10">
                                        <span>Shortfall (Unfunded)</span>
                                        <span className="font-medium">₹{(goal.amount - (goal.allocated || 0)).toLocaleString('en-IN')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </>
                      ) : (
                        renderEditGoalForm()
                      );
                      })()}
                    </motion.div>
                  ))}
                  </div>
                
                {editingGoalId === "new" && (
                  <motion.div 
                    className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-center relative border-primary/50"
                  >
                    {renderEditGoalForm()}
                  </motion.div>
                )}
              </div>

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
