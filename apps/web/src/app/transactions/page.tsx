"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { Plus } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Search, Filter } from "lucide-react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { getRecentTransactions } from "@/actions/transaction";
import { getHouseholdMembers, addHouseholdTag } from "@/actions/household";
import { AddExpenseModal } from "@/components/transactions/add-expense-modal";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import { format } from "date-fns";
import { deleteTransaction, updateTransactionTags } from "@/actions/transaction";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2, Tag, X } from "lucide-react";
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

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const loadTransactions = async () => {
    if (!activeHousehold?.householdId) return;
    setIsLoadingTx(true);
    setSelectedIds(new Set()); // Reset selections on load
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        // Fetch up to 1000 to cover full month securely
        const recentTx = await getRecentTransactions(token, activeHousehold.householdId, 1000, selectedMonth);
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
    
    // Check if we should open the modal from URL params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true") {
        setIsAddModalOpen(true);
        // Optional: remove it from URL so it doesn't re-trigger on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
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

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSelectAll = () => {
    const isAllSelected = paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id));
    if (isAllSelected) {
      // Deselect current page items
      const newSet = new Set(selectedIds);
      paginatedTransactions.forEach(tx => newSet.delete(tx.id));
      setSelectedIds(newSet);
    } else {
      // Select current page items
      const newSet = new Set(selectedIds);
      paginatedTransactions.forEach(tx => newSet.add(tx.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const confirmBulkDelete = async () => {
    if (!activeHousehold?.householdId || selectedIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const promises = Array.from(selectedIds).map(async (id) => {
        const tx = transactions.find(t => t.id === id);
        if (tx) await deleteTransaction(token, activeHousehold.householdId, tx.SK);
      });
      await Promise.all(promises);
      toast(`Successfully deleted ${selectedIds.size} transactions`);
      setSelectedIds(new Set());
      await loadTransactions();
    } catch (e) {
      toast("Failed to delete some transactions");
    } finally {
      setIsBulkUpdating(false);
      setIsBulkDeleteAlertOpen(false);
    }
  };

  const handleBulkAddTags = async () => {
    if (!activeHousehold?.householdId || selectedIds.size === 0 || !bulkTagInput.trim()) return;
    
    setIsBulkUpdating(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const newTags = bulkTagInput.split(",")
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => t.startsWith('#') ? t.substring(1) : t);

      const existingHouseholdTags = activeHousehold.metadata?.tags || [];
      const tagsToAddToHousehold = newTags.filter(t => !existingHouseholdTags.includes(t));
      
      for (const tag of tagsToAddToHousehold) {
        await addHouseholdTag(token, activeHousehold.householdId, tag);
      }

      const promises = Array.from(selectedIds).map(async (id) => {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
          const existingTags = tx.tags || [];
          const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
          await updateTransactionTags(token, activeHousehold.householdId, tx.SK, mergedTags);
        }
      });
      await Promise.all(promises);
      toast(`Successfully added tags to ${selectedIds.size} transactions`);
      setIsBulkTagModalOpen(false);
      setBulkTagInput("");
      await loadTransactions();
    } catch (e) {
      toast("Failed to add tags");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isHouseholdLoading) {
    return <PageLoader title="Loading your household..." />;
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
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setCurrentPage(1);
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 w-full sm:w-[150px]"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-primary font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{selectedIds.size}</span>
            <span>transactions selected</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" size="sm" onClick={() => setIsBulkTagModalOpen(true)} disabled={isBulkUpdating} className="flex-1 sm:flex-none">
              <Tag className="w-4 h-4 mr-2" /> Tag
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteAlertOpen(true)} disabled={isBulkUpdating} className="flex-1 sm:flex-none">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={isBulkUpdating} className="px-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {isLoadingTx ? (
        <PageLoader title="Loading transactions..." />
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
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-muted/50 p-4 border-b flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                checked={paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id))}
                onChange={handleSelectAll}
              />
              <span>Select All (Page {currentPage})</span>
            </div>
            <div className="text-muted-foreground">
              Total {filteredTransactions.length} results
            </div>
          </div>
          <div className="divide-y">
            {paginatedTransactions.map((tx) => {
              const myLiability = tx.splits?.[currentUserId || ""] || 0;
              const isPayer = tx.paidBy === currentUserId;
              const isSelected = selectedIds.has(tx.id);
              
              return (
                <div 
                  key={tx.id} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 transition-colors hover:bg-muted/50 gap-4 cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center h-full pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => toggleSelection(tx.id, e as any)}
                      />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold">
                      {tx.category.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{tx.category}</span>
                        <span>•</span>
                        <span>{format(new Date(tx.date || tx.createdAt), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center ml-8 sm:ml-0">
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between bg-muted/20">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
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
            onDelete={loadTransactions}
            onUpdate={(updatedTx) => {
              setSelectedTx(updatedTx);
              setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
            }}
          />

          {isBulkTagModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg relative">
                <button 
                  onClick={() => setIsBulkTagModalOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="text-lg font-bold mb-4">Attach Tags</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  These tags will be added to the {selectedIds.size} selected transactions. Use commas to separate multiple tags (e.g. #Trip, #Food).
                </p>
                <input
                  autoFocus
                  placeholder="#Vacation, #Dinner"
                  value={bulkTagInput}
                  onChange={e => setBulkTagInput(e.target.value)}
                  className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mb-4"
                />
                <Button className="w-full" onClick={handleBulkAddTags} disabled={isBulkUpdating || !bulkTagInput.trim()}>
                  {isBulkUpdating ? "Saving..." : "Apply Tags"}
                </Button>
              </div>
            </div>
          )}

          <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} transactions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete {selectedIds.size} selected transaction{selectedIds.size !== 1 ? 's' : ''} from your household and remove their tags.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isBulkUpdating}>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={confirmBulkDelete} disabled={isBulkUpdating}>
                  {isBulkUpdating ? "Deleting..." : "Delete"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
