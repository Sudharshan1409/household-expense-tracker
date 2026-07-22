"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createTemplate, updateTemplate } from "@/actions/recurring";
import { fetchAuthSession } from "aws-amplify/auth";
import { toast } from "sonner";

const CATEGORIES = [
  "Groceries", "Utilities", "Rent", "Dining Out", "Transportation", 
  "Travel", "Entertainment", "Healthcare", "Shopping", "Maintenance", 
  "Subscriptions", "Other"
];

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess: () => void;
  existingTemplate?: any;
}

export function TemplateModal({ isOpen, onClose, householdId, onSuccess, existingTemplate }: TemplateModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [transactionType, setTransactionType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingTemplate) {
        setDescription(existingTemplate.description || "");
        setAmount(existingTemplate.amount?.toString() || "");
        setCategory(existingTemplate.category || "Utilities");
        setTransactionType(existingTemplate.transactionType || "EXPENSE");
      } else {
        setDescription("");
        setAmount("");
        setCategory("Utilities");
        setTransactionType("EXPENSE");
      }
    }
  }, [isOpen, existingTemplate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    setIsSubmitting(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("Not authenticated");

      const data = {
        amount: Number(amount),
        description,
        category,
        transactionType
      };

      if (existingTemplate) {
        await updateTemplate(token, householdId, existingTemplate.id, data);
      } else {
        await createTemplate(token, householdId, data);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast("Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg sm:max-w-lg">
        <h2 className="text-xl font-semibold mb-4">
          {existingTemplate ? "Edit Template" : "New Recurring Template"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="text-sm font-medium">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="e.g. Rent, Netflix"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
