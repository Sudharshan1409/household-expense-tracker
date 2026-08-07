"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/ui/kpi-card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchAuthSession } from "aws-amplify/auth";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers } from "@/actions/household";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart as PieChartIcon, Download, Calendar, TrendingUp, Users, FileSpreadsheet, FileText, ArrowUpRight, ArrowDownRight, IndianRupee, Tag, Scale } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subMonths } from "date-fns";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function ReportsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const getISTMonthString = () => {
    const now = new Date();
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["Date", "Description", "Category", "Amount", "Paid By", "Type"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t => {
        const payer = members.find(m => m.userId === t.paidBy)?.userName || "Unknown";
        return `${format(new Date(t.date || t.createdAt), "dd/MM/yyyy")},"${t.description}",${t.category},${t.amount},"${payer}",${t.transactionType || "EXPENSE"}`;
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${selectedMonth}.csv`;
    link.click();
  };

  const handleExportExcel = () => {
    if (transactions.length === 0) return;
    const data = transactions.map(t => ({
      Date: format(new Date(t.date || t.createdAt), "dd/MM/yyyy"),
      Description: t.description,
      Category: t.category,
      Amount: t.amount,
      "Paid By": members.find(m => m.userId === t.paidBy)?.userName || "Unknown",
      Type: t.transactionType || "EXPENSE"
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `transactions_${selectedMonth}.xlsx`);
  };

  const handleExportPDF = () => {
    if (transactions.length === 0) return;
    const doc = new jsPDF();
    doc.text(`Household Transactions - ${selectedMonth}`, 14, 15);
    
    const tableColumn = ["Date", "Description", "Category", "Amount", "Paid By", "Type"];
    const tableRows = transactions.map(t => [
      format(new Date(t.date || t.createdAt), "dd/MM/yyyy"),
      t.description,
      t.category,
      t.amount.toString(),
      members.find(m => m.userId === t.paidBy)?.userName || "Unknown",
      t.transactionType || "EXPENSE"
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save(`transactions_${selectedMonth}.pdf`);
  };

  useEffect(() => {
    async function loadData() {
      if (!activeHousehold?.householdId) return;
      setIsLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, selectedMonth);
          setTransactions(recentTx);
          
          const [year, month] = selectedMonth.split("-").map(Number);
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear = month === 1 ? year - 1 : year;
          const prevMonthString = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
          const prevTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, prevMonthString);
          setPrevTransactions(prevTx);

          const mems = await getHouseholdMembers(token, activeHousehold.householdId);
          setMembers(mems);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeHousehold?.householdId, selectedMonth]);

  const getMemberName = (id: string) => {
    if (id === currentUserId) return "You";
    const m = members.find(m => m.userId === id);
    return m?.userName?.split('@')[0] || "Someone";
  };

  if (isHouseholdLoading) {
    return <div className="animate-pulse space-y-6"><div className="h-10 w-1/3 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;
  }

  // --- Data Crunching ---
  const expenseTxs = transactions.filter(tx => tx.transactionType !== "INCOME");
  const incomeTxs = transactions.filter(tx => tx.transactionType === "INCOME");

  const mySpend = expenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  const myIncome = incomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0);
  const mySavings = myIncome - mySpend;
  
  // Month-over-Month logic
  const prevExpenseTxs = prevTransactions.filter(tx => tx.transactionType !== "INCOME");
  const prevIncomeTxs = prevTransactions.filter(tx => tx.transactionType === "INCOME");
  const prevMySpend = prevExpenseTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  const prevMyIncome = prevIncomeTxs.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || (tx.paidBy === currentUserId ? tx.amount : 0)), 0);
  
  const mySpendDiff = prevMySpend > 0 ? ((mySpend - prevMySpend) / prevMySpend) * 100 : 0;
  const myIncomeDiff = prevMyIncome > 0 ? ((myIncome - prevMyIncome) / prevMyIncome) * 100 : 0;

  const incomeVsExpenseData = [
    { name: 'Income', amount: myIncome, fill: '#10b981' },
    { name: 'Expense', amount: mySpend, fill: '#ef4444' }
  ];
  
  // 1. Category Data (Individual Share)
  const categoryMap = expenseTxs.reduce((acc, tx) => {
    const cat = tx.category || "Other";
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    if (myShare > 0) {
      acc[cat] = (acc[cat] || 0) + myShare;
    }
    return acc;
  }, {} as Record<string, number>);
  const categoryData = Object.entries(categoryMap)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, value]) => ({ name, value }));

  // 2. Member Data (Who paid total household expenses)
  const memberMap = expenseTxs.reduce((acc, tx) => {
    const mName = getMemberName(tx.paidBy);
    acc[mName] = (acc[mName] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);
  const memberData = Object.entries(memberMap)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, value]) => ({ name, value }));

  // 3. Daily Trend Data (Individual Share)
  const dailyMap: Record<string, number> = {};
  [...expenseTxs].reverse().forEach(tx => {
    const dateStr = format(new Date(tx.date || tx.createdAt), "dd/MM/yyyy");
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    dailyMap[dateStr] = (dailyMap[dateStr] || 0) + myShare;
  });
  const dailyData = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

  // 4. Tags Data (Individual Share)
  const tagMap = expenseTxs.reduce((acc, tx) => {
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    if (myShare > 0 && tx.tags && tx.tags.length > 0) {
      tx.tags.forEach((t: string) => {
        acc[t] = (acc[t] || 0) + myShare;
      });
    }
    return acc;
  }, {} as Record<string, number>);
  
  const tagData = Object.entries(tagMap)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 10) // Top 10 tags
    .map(([name, value]) => ({ name: `#${name}`, value }));

  // Custom Tooltip Formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground border shadow-md rounded-lg p-3 text-sm">
          <p className="font-semibold mb-1">{label || payload[0].name}</p>
          <p className="text-primary">
            ₹{payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Analyze your spending habits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="flex justify-end gap-3 flex-wrap">
        <div className="flex rounded-md shadow-sm" role="group">
          <Button 
            variant="outline" 
            onClick={handleExportCSV} 
            disabled={isLoading || transactions.length === 0}
            className="h-10 rounded-none rounded-l-md border-r-0"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">CSV</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportExcel} 
            disabled={isLoading || transactions.length === 0}
            className="h-10 rounded-none border-r-0 text-green-600 dark:text-green-400"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Excel</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportPDF} 
            disabled={isLoading || transactions.length === 0}
            className="h-10 rounded-none rounded-r-md text-red-600 dark:text-red-400"
            title="Export to PDF"
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">PDF</span>
          </Button>
        </div>
        <Select 
          value={selectedMonth} 
          onValueChange={(val) => setSelectedMonth(val as string)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
              return (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {isHouseholdLoading || isLoading ? (
        <PageLoader title="Loading reports..." />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No data available"
          description={`No transactions found for ${selectedMonth}.`}
        />
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-6 flex flex-col justify-center space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <ArrowDownRight className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Total Income</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">₹{myIncome.toFixed(2)}</div>
                <div className="flex items-center gap-1.5 text-xs">
                  {myIncomeDiff !== 0 ? (
                    <span className={`inline-flex items-center font-medium ${myIncomeDiff >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {myIncomeDiff > 0 ? "+" : "-"}{Math.abs(myIncomeDiff).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground">+0%</span>
                  )}
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </div>
              
              <div className="p-6 flex flex-col justify-center space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Total Spend</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">₹{mySpend.toFixed(2)}</div>
                <div className="flex items-center gap-1.5 text-xs">
                  {mySpendDiff !== 0 ? (
                    <span className={`inline-flex items-center font-medium ${mySpendDiff <= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {mySpendDiff > 0 ? "+" : "-"}{Math.abs(mySpendDiff).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground">+0%</span>
                  )}
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </div>

              <div className="p-6 flex flex-col justify-center space-y-2 bg-muted/20">
                <div className="flex items-center gap-2 text-primary">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Net Savings</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">₹{mySavings.toFixed(2)}</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  <span className={`inline-flex items-center font-medium ${mySavings >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {mySavings >= 0 ? "Positive" : "Negative"} cash flow
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Category Pie Chart */}
            <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">By Category</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Member Pie Chart */}
            <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">By Member (Who Paid)</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {memberData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Daily Trend Bar Chart */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold tracking-tight">Daily Spending Trend</h2>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="date" 
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
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Income vs Expenses Bar Chart */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Scale className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">Income vs Expenses</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsExpenseData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis 
                      dataKey="name" 
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
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {incomeVsExpenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Tags Bar Chart */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Tag className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold tracking-tight">Spending by Tags (Top 10)</h2>
              </div>
              <div className="h-[300px] w-full">
                {tagData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                    <Tag className="h-8 w-8 opacity-20" />
                    No tagged expenses found
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tagData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis 
                        type="number"
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)", fontWeight: 500 }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
