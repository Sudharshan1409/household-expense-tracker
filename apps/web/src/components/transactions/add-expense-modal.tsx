"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Receipt, SplitSquareHorizontal, Camera } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { createTransaction } from "@/actions/transaction";
import { getHouseholdMembers } from "@/actions/household";
import { getUploadPresignedUrl } from "@/actions/s3";
import { useHousehold } from "@/components/providers/household-provider";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess: () => void;
  currentUserId?: string;
}

export function AddExpenseModal({ isOpen, onClose, householdId, onSuccess, currentUserId }: AddExpenseModalProps) {
  const { activeHousehold } = useHousehold();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [paidBy, setPaidBy] = useState(currentUserId || "");
  const [isShared, setIsShared] = useState(false);
  const [splitType, setSplitType] = useState<"EQUAL" | "PERCENTAGE" | "EXACT">("EQUAL");
  const [members, setMembers] = useState<any[]>([]);
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [transactionType, setTransactionType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setAmount("");
      setDescription("");
      setCategory("Other");
      setPaidBy(currentUserId || "");
      setIsShared(false);
      setSplitType("EQUAL");
      setSplits({});
      setTransactionType("EXPENSE");
      setReceiptFile(null);
      setError("");
    }
  }, [isOpen, currentUserId]);

  const loadMembers = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const mems = await getHouseholdMembers(token, householdId);
        setMembers(mems);
        
        // initialize splits evenly if EQUAL
        if (splitType === "EQUAL") {
          const defaultSplit = {};
          mems.forEach(m => defaultSplit[m.userId] = 0);
          setSplits(defaultSplit);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSplitChange = (userId: string, val: string) => {
    setSplits(prev => ({
      ...prev,
      [userId]: parseFloat(val) || 0
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    // Basic validation
    const totalAmount = parseFloat(amount);
    if (isShared) {
      if (splitType === "PERCENTAGE") {
        const totalPct = Object.values(splits).reduce((a, b) => a + b, 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          alert("Percentages must add up to 100%");
          return;
        }
      } else if (splitType === "EXACT") {
        const totalSplit = Object.values(splits).reduce((a, b) => a + b, 0);
        if (Math.abs(totalSplit - totalAmount) > 0.01) {
          alert(`Exact splits must add up to ${totalAmount}`);
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      let finalReceiptUrl = undefined;
      
      if (receiptFile) {
        try {
          // 1. Get presigned URL
          const { uploadUrl, publicUrl } = await getUploadPresignedUrl(token, householdId, receiptFile.name, receiptFile.type);
          
          // 2. Upload directly to S3
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": receiptFile.type,
            },
            body: receiptFile,
          });

          if (!uploadRes.ok) throw new Error("S3 Upload Failed");
          finalReceiptUrl = publicUrl;
        } catch (uploadError) {
          console.error("Receipt upload failed:", uploadError);
          // We can choose to fail the whole transaction or just continue without receipt. Let's continue without receipt but log it.
        }
      }

      await createTransaction(token, householdId, {
        amount: Number(amount),
        description,
        category,
        isShared,
        splitType: isShared ? splitType : "NONE",
        splits: isShared ? splits : {},
        date: new Date().toISOString(),
        transactionType,
        paidBy,
        receiptUrl: finalReceiptUrl,
      });

      onSuccess();
      onClose();
      // Reset form
      setAmount("");
      setDescription("");
      setIsShared(false);
      setSplitType("EQUAL");
    } catch (err) {
      console.error(err);
      alert("Failed to create expense");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg sm:rounded-2xl relative slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="mb-6 flex items-center gap-3 flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Add Expense</h2>
            <p className="text-sm text-muted-foreground">Record a new household expense</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 pb-2">
          <div className="space-y-4">
            {/* Transaction Type Toggle */}
            <div className="flex rounded-lg border p-1 bg-muted/50">
              <button
                type="button"
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  transactionType === "EXPENSE" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTransactionType("EXPENSE")}
              >
                Expense
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  transactionType === "INCOME" ? "bg-background shadow-sm text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTransactionType("INCOME")}
              >
                Income
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <input
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="e.g. Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isLoading}
                >
                  {activeHousehold?.categories?.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  )) || (
                    <option value="Other">Other</option>
                  )}
                </select>
              </div>
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Receipt Photo (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                disabled={isLoading}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            </div>

            <div className="border rounded-xl overflow-hidden mt-2">
              <div 
                className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer"
                onClick={() => setIsShared(!isShared)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isShared ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <SplitSquareHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Split this expense</h3>
                    <p className="text-xs text-muted-foreground">Share this cost with household members</p>
                  </div>
                </div>
                <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full">
                  <input type="checkbox" className="sr-only" checked={isShared} readOnly />
                  <span className={`flex h-5 w-9 rounded-full transition-colors ${isShared ? 'bg-primary' : 'bg-muted'}`}></span>
                  <span className={`absolute left-0.5 inline-block h-4 w-4 rounded-full bg-white transition-transform ${isShared ? 'translate-x-4' : 'translate-x-0'}`}></span>
                </div>
              </div>

              {isShared && (
                <div className="p-4 border-t bg-background space-y-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Split Method</label>
                    <div className="flex gap-2">
                      {["EQUAL", "PERCENTAGE", "EXACT"].map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={splitType === type ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSplitType(type as any);
                            setSplits({}); // reset splits on change
                          }}
                        >
                          {type === "EQUAL" ? "Equally" : type === "PERCENTAGE" ? "Percentage" : "Exact"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {splitType !== "EQUAL" && (
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">Member Splits</label>
                      <div className="space-y-2">
                        {members.map(m => (
                          <div key={m.userId} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium truncate flex-1">{m.userName || "Unknown"}</span>
                            <div className="flex items-center gap-2 w-1/3 relative">
                              <input
                                type="number"
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-right pr-6"
                                placeholder="0"
                                value={splits[m.userId] || ""}
                                onChange={(e) => handleSplitChange(m.userId, e.target.value)}
                              />
                              <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">
                                {splitType === "PERCENTAGE" ? "%" : "₹"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {splitType === "EQUAL" && (
                    <p className="text-sm text-muted-foreground text-center italic py-2">
                      This expense will be split equally among all {members.length} members.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Expense"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
