"use client";

import { useState, useEffect } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { getTransactionsFromDate, updateTransactionDebtLink } from "@/actions/transaction";
import { updateHouseholdDebts } from "@/actions/household";
import { fetchAuthSession } from "aws-amplify/auth";
import { 
  CreditCard, Plus, ArrowUpRight, TrendingDown, 
  Trash2, Landmark, CheckCircle2, AlertCircle, CalendarClock, Edit2, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import { DebtDetailsModal } from "@/components/debt/debt-details-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

export default function DebtPlannerPage() {
  const { activeHousehold, refreshHouseholds } = useHousehold();
  const [debts, setDebts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Debt Form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [newInterest, setNewInterest] = useState("");
  const [newMinPayment, setNewMinPayment] = useState("");

  // Edit Debt Form
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDebtId, setEditDebtId] = useState("");

  // Payment History
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDebtId, setHistoryDebtId] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Debt Details
  const [detailsDebt, setDetailsDebt] = useState<any>(null);
  
  // Delete Confirmation
  const [debtToDelete, setDebtToDelete] = useState<any>(null);

  useEffect(() => {
    if (activeHousehold) {
      setDebts(activeHousehold.metadata?.debts || []);
      fetchTransactions();
    }
  }, [activeHousehold]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token && activeHousehold) {
        // Fetch all transactions to find linked ones
        const txs = await getTransactionsFromDate(token, activeHousehold.householdId, "2000-01-01");
        setTransactions(txs.filter((t: any) => t.linkedDebtId));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDebt = async () => {
    if (!newName || !newBalance || !newInterest || !newMinPayment) return;
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token || !activeHousehold) return;

      const newDebt = {
        id: `debt_${Date.now()}`,
        name: newName,
        originalBalance: parseFloat(newBalance),
        interestRate: parseFloat(newInterest),
        minimumPayment: parseFloat(newMinPayment),
        createdAt: new Date().toISOString()
      };

      const updatedDebts = [...debts, newDebt];
      await updateHouseholdDebts(token, activeHousehold.householdId, updatedDebts);
      setDebts(updatedDebts);
      toast.success("Debt added successfully");
      setIsAddOpen(false);
      setNewName("");
      setNewBalance("");
      setNewInterest("");
      setNewMinPayment("");
      refreshHouseholds();
    } catch (e) {
      toast.error("Failed to add debt");
    }
  };

  const confirmDeleteDebt = async () => {
    if (!debtToDelete) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token || !activeHousehold) return;

      // Find linked transactions
      const linkedTxs = transactions.filter(t => t.linkedDebtId === debtToDelete.id);
      
      // Unlink all transactions
      for (const tx of linkedTxs) {
        await updateTransactionDebtLink(token, activeHousehold.householdId, tx.SK || tx.id, undefined);
      }

      const updatedDebts = debts.filter(d => d.id !== debtToDelete.id);
      await updateHouseholdDebts(token, activeHousehold.householdId, updatedDebts);
      
      setDebts(updatedDebts);
      toast.success(`Debt deleted and ${linkedTxs.length} transactions unlinked`);
      setDebtToDelete(null);
      refreshHouseholds();
      fetchTransactions();
    } catch (e) {
      toast.error("Failed to delete debt");
    }
  };

  const handleEditDebt = async () => {
    if (!newName || !newInterest || !newMinPayment) return;

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token || !activeHousehold) return;

      const debtIndex = debts.findIndex(d => d.id === editDebtId);
      if (debtIndex === -1) return;
      
      const debt = debts[debtIndex];
      const updatedDebt = { ...debt };
      
      updatedDebt.name = newName;
      updatedDebt.minimumPayment = parseFloat(newMinPayment);
      
      const newRate = parseFloat(newInterest);
      if (newRate !== debt.interestRate) {
        const rateChanges = debt.rateChanges || [{ date: debt.createdAt, rate: debt.interestRate }];
        rateChanges.push({ date: new Date().toISOString(), rate: newRate });
        updatedDebt.rateChanges = rateChanges;
        updatedDebt.interestRate = newRate; 
      }
      
      const updatedDebts = [...debts];
      updatedDebts[debtIndex] = updatedDebt;
      
      await updateHouseholdDebts(token, activeHousehold.householdId, updatedDebts);
      setDebts(updatedDebts);
      toast.success("Debt updated successfully");
      setIsEditOpen(false);
      refreshHouseholds();
    } catch (e) {
      toast.error("Failed to update debt");
    }
  };

  const getActiveRate = (targetDate: Date, debt: any) => {
    if (!debt.rateChanges || debt.rateChanges.length === 0) return debt.interestRate;
    
    let activeRate = debt.rateChanges[0].rate;
    for (const change of debt.rateChanges) {
      if (new Date(change.date).getTime() <= targetDate.getTime()) {
        activeRate = change.rate;
      }
    }
    return activeRate;
  };

  // Calculate current balances using Smart Amortization
  const getDebtStatus = (debt: any) => {
    const linkedTxs = transactions.filter(t => t.linkedDebtId === debt.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentBalance = debt.originalBalance;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    
    let lastDate = new Date(debt.createdAt);

    linkedTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      // Calculate months between last transaction and this one
      const monthsDiff = Math.max(0, (txDate.getFullYear() - lastDate.getFullYear()) * 12 + (txDate.getMonth() - lastDate.getMonth()));
      
      // Add interest for elapsed months using the rate active at txDate
      const activeRate = getActiveRate(txDate, debt);
      const monthlyRate = (activeRate / 100) / 12;
      const interestCharge = currentBalance * monthlyRate * monthsDiff;
      currentBalance += interestCharge;
      
      // Apply payment
      const payment = tx.amount;
      const interestPortion = Math.min(interestCharge, payment); // Simplified: payment covers interest first
      const principalPortion = payment - interestPortion;
      
      totalInterestPaid += interestPortion;
      totalPrincipalPaid += principalPortion;
      currentBalance -= payment;
      
      lastDate = txDate;
    });

    // Add interest from last transaction to TODAY
    let accruedInterest = 0;
    const now = new Date();
    const finalMonthsDiff = Math.max(0, (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth()));
    if (finalMonthsDiff > 0) {
      const activeRate = getActiveRate(now, debt);
      const monthlyRate = (activeRate / 100) / 12;
      const interestCharge = currentBalance * monthlyRate * finalMonthsDiff;
      currentBalance += interestCharge;
      accruedInterest = interestCharge;
    }

    currentBalance = Math.max(0, currentBalance);

    return {
      currentBalance,
      totalInterestPaid,
      totalPrincipalPaid,
      accruedInterest,
      progress: Math.min(100, ((debt.originalBalance - currentBalance) / debt.originalBalance) * 100)
    };
  };

  // Projection engine for Avalanche
  const generateProjection = () => {
    if (debts.length === 0) return [];

    let simulationDebts = debts.map(d => {
      const status = getDebtStatus(d);
      return {
        ...d,
        balance: status.currentBalance
      };
    }).filter(d => d.balance > 0);

    if (simulationDebts.length === 0) return [];

    const totalMinimums = simulationDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
    // Use exactly the minimums for baseline projection. 
    // In the future, we can add an "Extra Avalanche Budget" input.
    const monthlyBudget = totalMinimums; 
    
    let currentDate = new Date();
    currentDate.setDate(1); // start of month
    const projectionData = [];
    
    let loopProtect = 0;
    while (simulationDebts.length > 0 && loopProtect < 360) { // Max 30 years
      loopProtect++;
      
      let totalBalance = 0;
      let remainingBudget = monthlyBudget;
      
      // Sort by Avalanche (Highest interest rate first)
      simulationDebts.sort((a, b) => b.interestRate - a.interestRate);
      
      // 1. Charge interest & Pay minimums
      for (let i = 0; i < simulationDebts.length; i++) {
        let d = simulationDebts[i];
        const interest = d.balance * ((d.interestRate / 100) / 12);
        d.balance += interest;
        
        let payment = Math.min(d.minimumPayment, d.balance, remainingBudget);
        d.balance -= payment;
        remainingBudget -= payment;
      }
      
      // 2. Avalanche remaining budget onto highest interest debt
      if (remainingBudget > 0) {
        for (let i = 0; i < simulationDebts.length; i++) {
          if (remainingBudget <= 0) break;
          let d = simulationDebts[i];
          if (d.balance > 0) {
            let extraPayment = Math.min(d.balance, remainingBudget);
            d.balance -= extraPayment;
            remainingBudget -= extraPayment;
          }
        }
      }
      
      // 3. Cleanup paid off debts
      simulationDebts = simulationDebts.filter(d => d.balance > 0.01);
      
      totalBalance = simulationDebts.reduce((sum, d) => sum + d.balance, 0);
      
      let monthData: any = {
        month: currentDate.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
        balance: Math.round(totalBalance)
      };
      
      debts.forEach(origDebt => {
        const sim = simulationDebts.find(d => d.id === origDebt.id);
        const bal = sim ? Math.round(sim.balance) : 0;
        monthData[origDebt.name] = bal;
      });
      
      projectionData.push(monthData);
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return projectionData;
  };

  const projection = generateProjection();
  const isDebtFree = debts.length > 0 && projection.length === 0;
  const debtFreeDate = projection.length > 0 ? projection[projection.length - 1].month : "Now";

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Debt Planner</h2>
          <p className="text-muted-foreground mt-1">Track loans and accelerate your payoff using the Avalanche method.</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Debt
        </Button>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Debt</DialogTitle>
              <DialogDescription>
                Track a new loan or credit card balance.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Debt Name</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. HDFC Car Loan"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Current Balance (₹)</label>
                  <input 
                    type="number"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="100000"
                    value={newBalance}
                    onChange={e => setNewBalance(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Interest Rate (%)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="10.5"
                    value={newInterest}
                    onChange={e => setNewInterest(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Minimum Monthly Payment (₹)</label>
                <input 
                  type="number"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="5000"
                  value={newMinPayment}
                  onChange={e => setNewMinPayment(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddDebt}>Save Debt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Debt</DialogTitle>
              <DialogDescription>
                Update the interest rate or minimum payment. Rate changes apply from today forward.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Debt Name</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. HDFC Car Loan"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Interest Rate (%)</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="10.5"
                    value={newInterest}
                    onChange={e => setNewInterest(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Minimum Monthly Payment (₹)</label>
                  <input 
                    type="number"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="5000"
                    value={newMinPayment}
                    onChange={e => setNewMinPayment(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEditDebt}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
              <DialogDescription>
                Recent transactions linked to this debt.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-4">
                {transactions.filter(t => t.linkedDebtId === historyDebtId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).length > 0 ? (
                  transactions.filter(t => t.linkedDebtId === historyDebtId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                    <div 
                      key={tx.SK || tx.id} 
                      className="flex justify-between items-center p-3 border rounded-lg bg-card cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => {
                        setIsHistoryOpen(false);
                        setTimeout(() => setSelectedTransaction(tx), 100);
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{tx.title || tx.name || tx.description || 'EMI Payment'}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(tx.date).toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      </div>
                      <p className="font-bold text-emerald-500 text-right">₹{tx.amount.toLocaleString('en-IN')}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8 border border-dashed rounded-lg">No payments found.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsHistoryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {debts.length > 0 ? (
        <>
          {/* Projection Chart */}
          {!isDebtFree && projection.length > 0 && (
            <Card className="bg-gradient-to-br from-card to-card/50 border-red-500/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <TrendingDown className="h-32 w-32" />
              </div>
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5" />
                  Debt-Free Projection
                </CardTitle>
                <CardDescription>
                  Based on the Avalanche method (paying minimums + prioritizing high interest).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-8 items-end">
                  <div className="flex-1 w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projection} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          {debts.map((debt, index) => {
                            const colors = ["#ef4444", "#f97316", "#0ea5e9", "#84cc16", "#a855f7", "#eab308"];
                            const color = colors[index % colors.length];
                            return (
                              <linearGradient key={`gradient-${debt.id}`} id={`color-${debt.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={color} stopOpacity={0}/>
                              </linearGradient>
                            );
                          })}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value/1000)}k`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                          formatter={(value: any, name: any) => {
                            if (name === "balance") return null;
                            return [`₹${Number(value).toLocaleString('en-IN')}`, name];
                          }}
                        />
                        {debts.map((debt, index) => {
                          const colors = ["#ef4444", "#f97316", "#0ea5e9", "#84cc16", "#a855f7", "#eab308"];
                          const color = colors[index % colors.length];
                          return (
                            <Area 
                              key={debt.id}
                              type="monotone" 
                              dataKey={debt.name} 
                              stackId="1"
                              stroke={color} 
                              strokeWidth={2} 
                              fillOpacity={1} 
                              fill={`url(#color-${debt.id})`} 
                            />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl text-center min-w-[200px]">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Debt Free By</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{debtFreeDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isDebtFree && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-xl text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">You are Debt Free!</h3>
              <p className="text-emerald-600/80">All tracked loans have been paid off. Incredible job!</p>
            </div>
          )}

          {/* Debt Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {debts.map(debt => {
              const status = getDebtStatus(debt);
              const isPaidOff = status.currentBalance <= 0;

              return (
                <Card 
                  key={debt.id} 
                  className={`cursor-pointer hover:border-primary transition-colors ${isPaidOff ? "opacity-60 grayscale" : ""}`}
                  onClick={() => setDetailsDebt(debt)}
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-muted-foreground" />
                        {debt.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {debt.interestRate}% APR
                      </CardDescription>
                    </div>
                    <div className="flex -mt-2 -mr-2">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={(e) => {
                        e.stopPropagation();
                        setHistoryDebtId(debt.id);
                        setIsHistoryOpen(true);
                      }}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={(e) => {
                        e.stopPropagation();
                        setEditDebtId(debt.id);
                        setNewName(debt.name);
                        setNewInterest(debt.interestRate.toString());
                        setNewMinPayment(debt.minimumPayment.toString());
                        setIsEditOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => {
                        e.stopPropagation();
                        setDebtToDelete(debt);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="mb-4">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-2xl font-bold">₹{Math.round(status.currentBalance).toLocaleString('en-IN')}</span>
                        <span className="text-sm text-muted-foreground">left</span>
                      </div>
                      {status.accruedInterest > 0 && (
                        <p className="text-[10px] text-muted-foreground mb-2 -mt-1 text-red-400/80">
                          Includes ₹{Math.round(status.accruedInterest).toLocaleString('en-IN')} interest since last payment
                        </p>
                      )}
                      <Progress value={status.progress} className="w-full" trackClassName="h-2 bg-secondary" indicatorClassName={isPaidOff ? "bg-emerald-500" : "bg-red-500"} />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>Started: ₹{debt.originalBalance.toLocaleString('en-IN')}</span>
                        <span>{status.progress.toFixed(1)}% Paid</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t pt-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Min. Pay</p>
                        <p className="font-semibold text-sm">₹{debt.minimumPayment.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Principal</p>
                        <p className="font-semibold text-sm text-emerald-500">₹{Math.round(status.totalPrincipalPaid).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Interest</p>
                        <p className="font-semibold text-sm text-red-400">₹{Math.round(status.totalInterestPaid).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl border-border/50 bg-muted/10">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No debts tracked</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Add a loan or credit card to start tracking your payoff journey and see when you'll be debt-free.
          </p>
          <Button onClick={() => setIsAddOpen(true)}>Add Your First Debt</Button>
        </div>
      )}

      {activeHousehold && (
        <TransactionDetailsModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
          householdId={activeHousehold.householdId}
          onDelete={() => {
            fetchTransactions();
            refreshHouseholds();
          }}
          onUpdate={(updatedTx) => {
            setSelectedTransaction(updatedTx);
            fetchTransactions();
            refreshHouseholds();
          }}
        />
      )}

      {detailsDebt && (
        <DebtDetailsModal
          isOpen={!!detailsDebt}
          onClose={() => setDetailsDebt(null)}
          debt={detailsDebt}
          status={getDebtStatus(detailsDebt)}
        />
      )}

      <AlertDialog open={!!debtToDelete} onOpenChange={() => setDebtToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the debt <strong>{debtToDelete?.name}</strong>. 
              Any transactions currently linked to this debt will be kept but unlinked from this debt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDebt} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
