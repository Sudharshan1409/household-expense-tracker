"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Receipt, SplitSquareHorizontal, User, Loader2, Trash2 } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getHouseholdMembers } from "@/actions/household";
import { getDownloadPresignedUrl } from "@/actions/s3";
import { deleteTransaction, updateTransactionTags } from "@/actions/transaction";
import { addHouseholdTag } from "@/actions/household";
import { useHousehold } from "@/components/providers/household-provider";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
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
  const { activeHousehold } = useHousehold();
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isEditingTags, setIsEditingTags] = useState(false);

  useEffect(() => {
    if (transaction) {
      setTags(transaction.tags || []);
      setIsEditingTags(false);
      setTagInput("");
    }
  }, [transaction]);

  const handleSaveTags = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;
      
      // Save any new tags to the household
      for (const tag of tags) {
        if (!activeHousehold?.metadata?.tags?.includes(tag)) {
          await addHouseholdTag(token, householdId, tag);
        }
      }
      
      await updateTransactionTags(token, householdId, transaction.SK, tags);
      setIsEditingTags(false);
      toast("Tags updated successfully");
      if (onDelete) onDelete(); // Reusing the onDelete callback to trigger a refresh in the parent if needed.
    } catch (e) {
      toast("Failed to update tags");
    }
  };

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
      toast("Failed to securely open receipt");
    } finally {
      setIsOpeningReceipt(false);
    }
  };

  const handleDelete = async () => {
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
      toast("Failed to delete transaction");
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

          {/* Tags Section */}
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Tags / Events</h3>
              {!isEditingTags && (
                <button 
                  onClick={() => setIsEditingTags(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Edit Tags
                </button>
              )}
            </div>
            
            {!isEditingTags ? (
              <div className="flex flex-wrap gap-2">
                {tags.length > 0 ? tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                )) : <span className="text-xs text-muted-foreground">No tags</span>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-2 py-1 flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. #Goa2026"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        if (!tags.includes(tagInput.trim())) {
                          setTags([...tags, tagInput.trim()]);
                        }
                        setTagInput("");
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                        setTags([...tags, tagInput.trim()]);
                      }
                      setTagInput("");
                    }}
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                
                {/* Popular Tags Suggestion */}
                {activeHousehold?.metadata?.tags && activeHousehold.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {activeHousehold.metadata.tags
                      .filter((t: string) => !tags.includes(t))
                      .map((t: string) => (
                        <Badge 
                          key={t} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-muted text-xs font-normal"
                          onClick={() => setTags([...tags, t])}
                        >
                          + {t}
                        </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setTags(transaction.tags || []);
                    setIsEditingTags(false);
                  }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveTags}>Save Tags</Button>
                </div>
              </div>
            )}
          </div>
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
            
            <AlertDialog>
              <AlertDialogTrigger type="button" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this transaction from the household.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, delete it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
