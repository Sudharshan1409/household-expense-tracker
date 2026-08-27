"use client";

import { useState, useEffect } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { useAuthSWR } from "@/hooks/use-auth-swr";
import { getTransactionsFromDate } from "@/actions/transaction";
import { fetchAuthSession } from "aws-amplify/auth";
import { PageLoader } from "@/components/ui/page-loader";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Trophy, TrendingDown, Landmark, PieChart, Coins } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WrappedPage() {
  const { activeHousehold, isLoading: isHouseholdLoading } = useHousehold();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [step, setStep] = useState(0);

  useEffect(() => {
    async function fetchAllData() {
      if (!activeHousehold?.householdId) return;
      setIsLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          const txs = await getTransactionsFromDate(token, activeHousehold.householdId, "2000-01-01");
          setTransactions(txs);
          
          // Determine available years
          const years = new Set<number>();
          txs.forEach((tx: any) => {
            const date = new Date(tx.date || tx.createdAt);
            if (!isNaN(date.getFullYear())) {
              years.add(date.getFullYear());
            }
          });
          const sortedYears = Array.from(years).sort((a, b) => b - a);
          setAvailableYears(sortedYears);
          
          if (sortedYears.length > 0 && !sortedYears.includes(selectedYear)) {
            setSelectedYear(sortedYears[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (activeHousehold) {
      fetchAllData();
    }
  }, [activeHousehold]);

  if (isHouseholdLoading || isLoading) {
    return <PageLoader />;
  }

  if (availableYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-medium">Not enough data yet.</h2>
        <p className="text-muted-foreground">Start tracking expenses to see your Household Wrapped!</p>
        <Link href="/reports">
          <Button variant="outline">Back to Reports</Button>
        </Link>
      </div>
    );
  }

  const yearTxs = transactions.filter(tx => {
    const d = new Date(tx.date || tx.createdAt);
    return d.getFullYear() === selectedYear;
  });

  const expenseTxs = yearTxs.filter(tx => tx.transactionType !== "INCOME");
  const incomeTxs = yearTxs.filter(tx => tx.transactionType === "INCOME");
  const debtTxs = expenseTxs.filter(tx => tx.linkedDebtId);

  const totalSpent = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const totalDebtPaid = debtTxs.reduce((sum, tx) => sum + tx.amount, 0);
  
  const categories = expenseTxs.reduce((acc: any, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
  const topCategories = Object.entries(categories).sort(([,a]: any, [,b]: any) => b - a).slice(0, 3);
  const topCategoryName = topCategories.length > 0 ? topCategories[0][0] : "Nothing";

  const months = expenseTxs.reduce((acc: any, tx) => {
    const m = new Date(tx.date || tx.createdAt).getMonth();
    acc[m] = (acc[m] || 0) + tx.amount;
    return acc;
  }, {});
  const topMonth = Object.entries(months).sort(([,a]: any, [,b]: any) => b - a)[0];
  const topMonthName = topMonth ? new Date(0, Number(topMonth[0])).toLocaleString('default', { month: 'long' }) : "None";

  const slides = [
    {
      id: 0,
      title: "Your Year in Review",
      content: (
        <div className="text-center space-y-6">
          <Sparkles className="h-20 w-20 mx-auto text-indigo-400 animate-pulse" />
          <h1 className="text-5xl font-black bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            {selectedYear} Wrapped
          </h1>
          <p className="text-xl text-muted-foreground">Let's look back at how your household managed its money.</p>
        </div>
      )
    },
    {
      id: 1,
      title: "The Big Picture",
      content: (
        <div className="text-center space-y-8">
          <Landmark className="h-16 w-16 mx-auto text-emerald-400" />
          <div>
            <p className="text-xl text-muted-foreground mb-2">Together, you spent a total of</p>
            <h2 className="text-6xl font-black text-emerald-500">₹{totalSpent.toLocaleString()}</h2>
          </div>
          {totalIncome > 0 && (
            <p className="text-lg text-muted-foreground mt-4">
              But you brought in ₹{totalIncome.toLocaleString()}!
            </p>
          )}
        </div>
      )
    },
    {
      id: 2,
      title: "Category Superlatives",
      content: (
        <div className="text-center space-y-6">
          <PieChart className="h-16 w-16 mx-auto text-pink-400" />
          <p className="text-xl text-muted-foreground">Your biggest weakness was</p>
          <h2 className="text-5xl font-black text-pink-500 capitalize">{topCategoryName}</h2>
          <div className="pt-8 space-y-3 max-w-sm mx-auto">
            {topCategories.map((c: any, i) => (
              <div key={i} className="flex justify-between items-center text-lg bg-muted/30 p-3 rounded-lg">
                <span className="capitalize">#{i+1} {c[0]}</span>
                <span className="font-bold">₹{c[1].toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Highest Spending Month",
      content: (
        <div className="text-center space-y-6">
          <TrendingDown className="h-16 w-16 mx-auto text-orange-400" />
          <p className="text-xl text-muted-foreground">Your most expensive month was</p>
          <h2 className="text-5xl font-black text-orange-500">{topMonthName}</h2>
          {topMonth && (
            <p className="text-lg text-muted-foreground mt-4">
              You spent ₹{Number(topMonth[1]).toLocaleString()} during this month.
            </p>
          )}
        </div>
      )
    },
    {
      id: 4,
      title: "Debt Crushers",
      content: (
        <div className="text-center space-y-6">
          <Trophy className="h-16 w-16 mx-auto text-amber-400" />
          {totalDebtPaid > 0 ? (
            <>
              <p className="text-xl text-muted-foreground">You absolutely crushed your loans!</p>
              <h2 className="text-5xl font-black text-amber-500">₹{totalDebtPaid.toLocaleString()}</h2>
              <p className="text-lg text-muted-foreground mt-4">paid towards debt this year.</p>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-black text-amber-500">No debt payments tracked!</h2>
              <p className="text-lg text-muted-foreground mt-4">You're either debt-free or need to link your payments to the Debt Planner!</p>
            </>
          )}
        </div>
      )
    }
  ];

  const handleNext = () => setStep(s => Math.min(s + 1, slides.length - 1));
  const handlePrev = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div 
      className="bg-background text-foreground flex flex-col relative overflow-hidden rounded-xl border shadow-sm"
      style={{ height: "calc(100dvh - 6rem)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-background to-pink-500/5 pointer-events-none" />
      
      <div className="p-4 z-10 flex items-center justify-between">
        <Link href="/reports">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        
        {availableYears.length > 1 && (
          <select 
            value={selectedYear} 
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setStep(0); }}
            className="bg-transparent border border-input rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="flex-1 w-full z-10 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-2xl py-8"
            >
              {slides[step].content}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 md:p-8 z-10 flex items-center justify-between max-w-2xl mx-auto w-full bg-background/80 backdrop-blur-sm border-t md:border-t-0 md:bg-transparent md:backdrop-blur-none">
        <Button variant="ghost" onClick={handlePrev} disabled={step === 0} className="w-24">
          Previous
        </Button>
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <div key={i} className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-primary/20'}`} />
          ))}
        </div>
        <Button variant="default" onClick={handleNext} disabled={step === slides.length - 1} className="w-24">
          {step === slides.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}
