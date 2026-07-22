"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Search, Filter } from "lucide-react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers } from "@/actions/household";
import { AddExpenseModal } from "@/components/transactions/add-expense-modal";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";

export default function TransactionsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, currentUserId } = useHousehold();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterMember, setFilterMember] = useState("ALL");

  // Default to current month in IST
  const getISTMonthString = () => {
    const now = new Date();
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getISTMonthString());

  const loadTransactions = async () => {
    if (!activeHousehold?.householdId) return;
    setIsLoadingTx(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 100, selectedMonth);
        setTransactions(recentTx);
        
        const mems = await getHouseholdMembers(token, activeHousehold.householdId);
        setMembers(mems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTx(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [activeHousehold?.householdId, selectedMonth]);

  const getMemberName = (id: string) => {
    if (id === currentUserId) return "you";
    const m = members.find(m => m.userId === id);
    return m?.userName || "someone else";
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "ALL" || tx.category === filterCategory;
    const matchesMember = filterMember === "ALL" || tx.paidBy === filterMember;
    return matchesSearch && matchesCategory && matchesMember;
  });

  if (isHouseholdLoading) {
    return <div className="animate-pulse space-y-6"><div className="h-10 w-1/3 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage your household expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
          <Button className="hidden sm:flex" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
        </div>
        
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 w-full sm:w-[150px]"
        >
          <option value="ALL">All Categories</option>
          {activeHousehold?.categories?.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 w-full sm:w-[150px]"
        >
          <option value="ALL">All Members</option>
          {members.map(m => (
            <option key={m.userId} value={m.userId}>{m.userName}</option>
          ))}
        </select>

        <input 
          type="month" 
          value={selectedMonth}
          max={getISTMonthString()}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 w-full sm:w-[150px]"
        />
      </div>

      {isLoadingTx ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description={`Try adjusting your filters or add a new expense for ${selectedMonth}.`}
          action={
            <Button variant="outline" className="mt-4" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="divide-y">
            {filteredTransactions.map((tx) => {
              const myLiability = tx.splits?.[currentUserId || ""] || 0;
              const isPayer = tx.paidBy === currentUserId;
              
              return (
                <div 
                  key={tx.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 transition-colors hover:bg-muted/50 gap-4 cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold">
                      {tx.category.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{tx.category}</span>
                        <span>•</span>
                        <span>{new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <div className="font-bold text-lg">
                      ₹{tx.amount.toFixed(2)}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${isPayer ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {isPayer ? "Paid by you" : tx.isShared ? `Your share: ₹${myLiability.toFixed(2)}` : `Paid by ${getMemberName(tx.paidBy)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeHousehold?.householdId && (
        <>
          <AddExpenseModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            householdId={activeHousehold.householdId}
            onSuccess={loadTransactions}
          />
          <TransactionDetailsModal
            isOpen={!!selectedTx}
            onClose={() => setSelectedTx(null)}
            transaction={selectedTx}
            householdId={activeHousehold.householdId}
          />
        </>
      )}
    </div>
  );
}
