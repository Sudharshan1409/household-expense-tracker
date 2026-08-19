import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useMemo } from "react";

interface DailyAvgModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: any[];
  fixedCategories: string[];
  currentUserId: string | null;
  selectedMonth: string;
  currentDay: number;
}

export function DailyAvgModal({ isOpen, onClose, transactions, fixedCategories, currentUserId, selectedMonth, currentDay }: DailyAvgModalProps) {
  const chartData = useMemo(() => {
    if (!isOpen) return [];

    const expenseTxs = transactions.filter(t => t.transactionType !== "INCOME" && !fixedCategories.includes(t.category));
    
    const dailyMap: Record<string, number> = {};
    expenseTxs.forEach(tx => {
      const dateStr = format(new Date(tx.date || tx.createdAt), "yyyy-MM-dd");
      const myShare = tx.isShared ? (tx.splits?.[currentUserId || ""] || 0) : (tx.paidBy === currentUserId ? tx.amount : 0);
      dailyMap[dateStr] = (dailyMap[dateStr] || 0) + myShare;
    });

    const [year, month] = selectedMonth.split("-").map(Number);
    const data = [];
    
    for (let d = 1; d <= currentDay; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = format(dateObj, "yyyy-MM-dd");
      const displayDate = format(dateObj, "dd MMM");
      
      data.push({
        date: displayDate,
        amount: dailyMap[dateStr] || 0
      });
    }

    return data;
  }, [transactions, fixedCategories, currentUserId, selectedMonth, currentDay, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl sm:max-w-3xl w-[95vw] !ring-0 border-none bg-background/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle>Your Daily Spend Trend</DialogTitle>
          <DialogDescription>
            Daily breakdown of your variable expenses for this month.
          </DialogDescription>
        </DialogHeader>

        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                angle={-45}
                textAnchor="end"
                height={50}
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
                formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, "Spent"]}
                labelStyle={{ fontWeight: "bold", color: "var(--foreground)", marginBottom: "4px" }}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="var(--primary)" 
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--background)", stroke: "var(--primary)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--primary)" }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
