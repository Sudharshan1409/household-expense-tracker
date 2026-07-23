"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useHousehold } from "@/components/providers/household-provider";
import { deleteHouseholdTag } from "@/actions/household";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hash, Trash2, Calendar, Receipt, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { TransactionDetailsModal } from "@/components/transactions/transaction-details-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getTransactionsByTag, removeTagFromHouseholdTransactions } from "@/actions/transaction";

export default function TagsPage() {
  const { activeHousehold, isLoading: isHouseholdLoading, refreshHouseholds } = useHousehold();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // We don't auto-select a tag anymore to prevent auto-loading expenses.
  
  const loadTransactions = async (tagToLoad: string) => {
    if (!activeHousehold?.householdId) return;
    
    setIsLoadingTx(true);
    setTransactions([]); // Clear current list when selecting a new tag
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const items = await getTransactionsByTag(
          token, 
          activeHousehold.householdId, 
          tagToLoad
        );
        
        setTransactions(items);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load tag transactions");
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleSelectTag = (tag: string) => {
    if (selectedTag === tag) return; // Ignore if already selected
    setSelectedTag(tag);
    loadTransactions(tag);
  };

  if (isHouseholdLoading) {
    return <PageLoader title="Loading tags..." />;
  }

  const tags: string[] = activeHousehold?.metadata?.tags || [];

  const handleDeleteTag = async () => {
    if (!activeHousehold?.householdId || !selectedTag) return;
    setIsDeleting(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      await removeTagFromHouseholdTransactions(token, activeHousehold.householdId, selectedTag);
      await deleteHouseholdTag(token, activeHousehold.householdId, selectedTag);
      
      toast(`Tag #${selectedTag} has been completely deleted`);
      
      setSelectedTag(null);
      await refreshHouseholds();
    } catch (err) {
      console.error(err);
      toast("Failed to delete tag");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tags & Events</h1>
          <p className="text-muted-foreground mt-1">
            View all expenses across time grouped by tags
          </p>
        </div>
      </div>

      {tags.length === 0 ? (
        <EmptyState 
          title="No tags created yet" 
          description="Create tags when adding a new expense to organize them by events, trips, or special categories."
          icon={<Hash className="w-12 h-12 text-muted-foreground/50" />}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Available Tags</h3>
            <div className="flex lg:flex-col flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleSelectTag(tag)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all border text-sm font-medium ${
                    selectedTag === tag 
                      ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                      : "bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    #{tag}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${selectedTag === tag ? "opacity-100" : "opacity-0 lg:opacity-50"}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-6">
            {selectedTag && (
              <>
                <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Hash className="w-6 h-6 text-primary" />
                      #{selectedTag}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      {transactions.length} expense{transactions.length !== 1 ? 's' : ''} found across all time
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Total Spent</p>
                      <p className="text-2xl font-bold">₹{totalSpent.toFixed(2)}</p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger 
                        className={cn(
                          buttonVariants({ variant: "outline", size: "icon" }), 
                          "text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tag #{selectedTag}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will untag all {transactions.length} expenses associated with this tag. The expenses themselves will NOT be deleted. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteTag} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            {isDeleting ? "Deleting..." : "Yes, remove tag"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                  {isLoadingTx ? (
                    <div className="p-12 flex justify-center">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                      <Receipt className="w-12 h-12 opacity-20" />
                      <p>No transactions found for this tag.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {transactions.map((tx) => (
                        <div 
                          key={tx.id}
                          className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                          onClick={() => {
                            setSelectedTx(tx);
                            setIsModalOpen(true);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{tx.description}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span>{tx.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(tx.date || tx.createdAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">₹{tx.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            
            {!selectedTag && (
              <div className="bg-card rounded-2xl border p-12 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Hash className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Select a tag to view expenses</h3>
                <p className="text-muted-foreground max-w-md">
                  Click on any of your tags on the left to instantly see all expenses associated with it across time.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTx && (
        <TransactionDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          transaction={selectedTx}
          householdId={activeHousehold?.householdId || ""}
          onDelete={() => {
            setTransactions(prev => prev.filter(t => t.id !== selectedTx.id));
            setIsModalOpen(false);
          }}
          onUpdate={(updatedTx) => {
            setSelectedTx(updatedTx);
            setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
          }}
        />
      )}
    </div>
  );
}
