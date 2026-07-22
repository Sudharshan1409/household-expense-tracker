"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { Button } from "@/components/ui/button";
import { fetchAuthSession } from "aws-amplify/auth";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers } from "@/actions/household";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { PieChart as PieChartIcon, Download, Calendar, TrendingUp, Users, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function ReportsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
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
        return `${new Date(t.date).toLocaleDateString()},"${t.description}",${t.category},${t.amount},"${payer}",${t.transactionType || "EXPENSE"}`;
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
      Date: new Date(t.date).toLocaleDateString(),
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
      new Date(t.date).toLocaleDateString(),
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
  const mySpend = transactions.reduce((sum, tx) => sum + (tx.splits?.[currentUserId || ""] || 0), 0);
  
  // 1. Category Data (Individual Share)
  const categoryMap = transactions.reduce((acc, tx) => {
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

  // 2. Member Data (Who paid for MY expenses)
  const memberMap = transactions.reduce((acc, tx) => {
    const mName = getMemberName(tx.paidBy);
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    if (myShare > 0) {
      acc[mName] = (acc[mName] || 0) + myShare;
    }
    return acc;
  }, {} as Record<string, number>);
  const memberData = Object.entries(memberMap)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, value]) => ({ name, value }));

  // 3. Daily Trend Data (Individual Share)
  const dailyMap: Record<string, number> = {};
  [...transactions].reverse().forEach(tx => {
    const dateStr = new Date(tx.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const myShare = tx.splits?.[currentUserId || ""] || 0;
    dailyMap[dateStr] = (dailyMap[dateStr] || 0) + myShare;
  });
  const dailyData = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

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
        <input 
          type="month" 
          value={selectedMonth}
          max={getISTMonthString()}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        />
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-muted rounded-xl"></div>
          <div className="h-48 bg-muted rounded-xl"></div>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<PieChartIcon className="h-10 w-10 text-muted-foreground" />}
          title="Not enough data"
          description={`Add more expenses for ${selectedMonth} to see detailed charts and reports.`}
        />
      ) : (
        <div className="space-y-6">
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
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
