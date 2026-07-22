"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Receipt, SplitSquareHorizontal, User, Loader2, Trash2 } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getHouseholdMembers } from "@/actions/household";
import { getDownloadPresignedUrl } from "@/actions/s3";
import { deleteTransaction } from "@/actions/transaction";
import { format } from "date-fns";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  householdId: string;
  onDelete?: () => void;
}

export function TransactionDetailsModal({ isOpen, onClose, transaction, householdId, onDelete }: TransactionDetailsModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningReceipt, setIsOpeningReceipt] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token && householdId) {
        const mems = await getHouseholdMembers(token, householdId);
        setMembers(mems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && transaction) {
      loadMembers();
    }
  }, [isOpen, transaction]);

  const handleViewReceipt = async () => {
    if (!transaction?.receiptUrl) return;
    try {
      setIsOpeningReceipt(true);
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const presignedUrl = await getDownloadPresignedUrl(token, transaction.receiptUrl);
        setViewerUrl(presignedUrl);
      }
    } catch (err) {
      console.error("Failed to open receipt", err);
      alert("Failed to securely open receipt");
    } finally {
      setIsOpeningReceipt(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this transaction? This cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await deleteTransaction(token, householdId, transaction.SK);
        if (onDelete) onDelete();
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete transaction");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const getMemberName = (id: string) => {
    const m = members.find(m => m.userId === id);
    return m?.userName || "Unknown";
  };

  const payerName = getMemberName(transaction.paidBy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-lg sm:rounded-2xl relative slide-in-from-bottom-4 duration-300 flex flex-col">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-6 pb-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <Receipt className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{transaction.description}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{transaction.category}</span>
            <span>•</span>
            <span>{format(new Date(transaction.date || transaction.createdAt), "dd/MM/yyyy")}</span>
          </div>
          
          <div className="mt-6 flex flex-col items-center justify-center p-6 bg-muted/20 rounded-xl border border-dashed">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Amount</span>
            <span className="text-4xl font-bold">₹{transaction.amount.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground mt-2">Paid by <strong className="text-foreground">{payerName}</strong></span>
          </div>

          {transaction.receiptUrl && (
            <div className="mt-4">
              <button 
                onClick={handleViewReceipt}
                disabled={isOpeningReceipt}
                className="flex items-center justify-center gap-2 w-full py-2 bg-muted/50 hover:bg-muted text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isOpeningReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                {isOpeningReceipt ? "Securely Opening..." : "View Original Receipt"}
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Split Details</h3>
          
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map(i => <div key={i} className="h-10 bg-muted rounded-md" />)}
            </div>
          ) : (
            <div className="space-y-3 border rounded-xl divide-y">
              {transaction.splits && Object.entries(transaction.splits).map(([userId, amount]: [string, any]) => {
                if (amount === 0) return null; // Don't show users who didn't participate in this split
                return (
                  <div key={userId} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">{getMemberName(userId)}</span>
                    </div>
                    <span className="font-semibold">₹{Number(amount).toFixed(2)}</span>
                  </div>
                );
              })}
              
              {(!transaction.splits || Object.keys(transaction.splits).length === 0) && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  This was a personal expense (not shared).
                </div>
              )}
            </div>
          )}
          
          <div className="mt-8 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </div>
      
      {viewerUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-card rounded-2xl border shadow-2xl relative overflow-hidden slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2"><Receipt className="h-5 w-5" /> Receipt Viewer</h3>
              <button 
                onClick={() => setViewerUrl(null)}
                className="rounded-full p-2 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-muted/10 p-4">
              <iframe 
                src={viewerUrl} 
                className="w-full h-full rounded-xl border bg-white" 
                title="Receipt Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
