import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface PacingChartProps {
  transactions: any[];
  prevTransactions: any[];
  budget?: number;
  overallBudget?: number;
  currentUserId?: string | null;
  selectedMonth: string; // "YYYY-MM" format
}

export function PacingChart({ transactions, prevTransactions, budget, overallBudget, currentUserId, selectedMonth }: PacingChartProps) {
  const [viewMode, setViewMode] = useState<"household" | "individual">("household");

  const chartData = useMemo(() => {
    // Determine the number of days in the selected month
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    
    // Get last day of month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Check if the selected month is the current real-world month
    const now = new Date();
    // Adjust to IST
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    
    const isCurrentMonth = year === now.getUTCFullYear() && month === (now.getUTCMonth() + 1);
    const currentDay = isCurrentMonth ? now.getUTCDate() : daysInMonth;

    // Filter only expenses
    const expenseTxs = transactions.filter(t => t.transactionType !== "INCOME");
    const prevExpenseTxs = prevTransactions.filter(t => t.transactionType !== "INCOME");

    const hasPrevData = prevExpenseTxs.length > 0;
    const getSpendForTx = (t: any) => {
      if (viewMode === "household") return t.amount || 0;
      return t.splits?.[currentUserId || ""] || 0;
    };

    const activeBudget = viewMode === "household" ? overallBudget : budget;
    
    let cumulativeSpend = 0;
    let prevCumulativeSpend = 0;
    
    const data = [];
    
    for (let day = 1; day <= currentDay; day++) {
      // Find expenses for this specific day (current month)
      const daySpend = expenseTxs.filter((t) => {
        const d = new Date(t.date || t.createdAt);
        return d.getDate() === day;
      }).reduce((sum, t) => sum + getSpendForTx(t), 0);
      
      // Find expenses for this specific day (prev month)
      const prevDaySpend = prevExpenseTxs.filter((t) => {
        const d = new Date(t.date || t.createdAt);
        return d.getDate() === day;
      }).reduce((sum, t) => sum + getSpendForTx(t), 0);

      cumulativeSpend += daySpend;
      prevCumulativeSpend += prevDaySpend;
      
      let ghostSpend = null;
      let label = "";

      if (hasPrevData) {
        ghostSpend = prevCumulativeSpend;
        label = "Vs. Last Month";
      } else if (activeBudget) {
        // Ideal pace (divide by total days in month, not currentDay, so it targets the correct month-end goal)
        ghostSpend = (activeBudget / daysInMonth) * day;
        label = "Vs. Ideal Pace";
      }
      
      data.push({
        day,
        currentSpend: cumulativeSpend,
        ghostSpend: ghostSpend,
        label
      });
    }

    return data;
  }, [transactions, prevTransactions, budget, overallBudget, currentUserId, selectedMonth, viewMode]);

  // Determine if we are currently "losing" the race (current spend > ghost spend)
  const isLosing = useMemo(() => {
    // Find the last valid day
    let lastValidDay = chartData.filter(d => d.currentSpend !== null).pop();
    if (!lastValidDay) return false;
    
    if (lastValidDay.ghostSpend !== null && lastValidDay.currentSpend !== null) {
      return lastValidDay.currentSpend > lastValidDay.ghostSpend;
    }
    return false;
  }, [chartData]);

  if (chartData.length === 0) return null;
  const hasGhost = chartData[0].ghostSpend !== null;
  const ghostLabel = chartData[0].label;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight">Pacing Chart 🏎️👻</h2>
              <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/50">
                <button
                  onClick={() => setViewMode("household")}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${viewMode === "household" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Household
                </button>
                <button
                  onClick={() => setViewMode("individual")}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${viewMode === "individual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  My Spend
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {hasGhost 
                ? `Racing against your ${ghostLabel.replace("Vs. ", "").toLowerCase()}.` 
                : "Tracking your monthly spend."}
            </p>
          </div>
          {hasGhost && (
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isLosing ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"}`}>
              {isLosing ? "Falling Behind Pace" : "Beating the Pace!"}
            </div>
          )}
        </div>
        
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis 
                dataKey="day" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={(val) => `${val}`}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={(val) => `₹${val > 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "var(--card)", 
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
                formatter={(value: any, name: any) => [
                  `₹${value.toFixed(2)}`, 
                  name === "currentSpend" ? "Current Spend" : ghostLabel
                ]}
                labelFormatter={(label) => `Day ${label}`}
              />
              {hasGhost && (
                <Line 
                  type="monotone" 
                  dataKey="ghostSpend" 
                  stroke="var(--muted-foreground)" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  opacity={0.5}
                />
              )}
              <Line 
                type="monotone" 
                dataKey="currentSpend" 
                stroke={isLosing ? "var(--destructive)" : "var(--primary)"} 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: isLosing ? "var(--destructive)" : "var(--primary)" }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
