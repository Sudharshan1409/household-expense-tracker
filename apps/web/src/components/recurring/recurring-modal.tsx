"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createTemplate, updateTemplate } from "@/actions/recurring";
import { getHouseholdMembers, addHouseholdTag } from "@/actions/household";
import { fetchAuthSession } from "aws-amplify/auth";
import { SplitSquareHorizontal, X, Info, Hash } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/components/providers/household-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess: () => void;
  existingTemplate?: any;
}

export function TemplateModal({ isOpen, onClose, householdId, onSuccess, existingTemplate }: TemplateModalProps) {
  const { activeHousehold } = useHousehold();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [transactionType, setTransactionType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  
  const [isShared, setIsShared] = useState(false);
  const [splitType, setSplitType] = useState<"EQUAL" | "PERCENTAGE" | "EXACT">("EQUAL");
  const [members, setMembers] = useState<any[]>([]);
  const [splits, setSplits] = useState<Record<string, number>>({});
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadMembers = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const mems = await getHouseholdMembers(token, householdId);
        setMembers(mems);
        
        if (mems.length > 0 && !existingTemplate?.splits) {
          const defaultSplit: Record<string, number> = {};
          mems.forEach(m => defaultSplit[m.userId] = 0);
          setSplits(defaultSplit);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      if (existingTemplate) {
        setDescription(existingTemplate.description || "");
        setAmount(existingTemplate.amount?.toString() || "");
        setCategory(existingTemplate.category || "Utilities");
        setTransactionType(existingTemplate.transactionType || "EXPENSE");
        setIsShared(existingTemplate.isShared || false);
        setSplitType(existingTemplate.splitType || "EQUAL");
        setSplits(existingTemplate.splits || {});
        setTags(existingTemplate.tags || []);
        setTagInput("");
      } else {
        setDescription("");
        setAmount("");
        setCategory(activeHousehold?.categories?.[0] || "Utilities");
        setTransactionType("EXPENSE");
        setIsShared(false);
        setSplitType("EQUAL");
        setSplits({});
        setTags([]);
        setTagInput("");
      }
    }
  }, [isOpen, existingTemplate, householdId]);

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

    const totalAmount = parseFloat(amount);
    if (transactionType === "EXPENSE" && isShared) {
      if (splitType === "PERCENTAGE") {
        const totalPct = Object.values(splits).reduce((a, b) => a + b, 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          toast.error("Percentages must add up to 100%");
          return;
        }
      } else if (splitType === "EXACT") {
        const totalSplit = Object.values(splits).reduce((a, b) => a + b, 0);
        if (Math.abs(totalSplit - totalAmount) > 0.01) {
          toast.error(`Exact splits must add up to ${totalAmount}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("Not authenticated");

      const data = {
        amount: totalAmount,
        description,
        category: transactionType === "INCOME" ? "Income" : category,
        transactionType,
        isShared: transactionType === "EXPENSE" ? isShared : false,
        splitType: (transactionType === "EXPENSE" && isShared) ? splitType : "NONE",
        splits: (transactionType === "EXPENSE" && isShared) ? splits : {},
        tags
      };

      const existingHouseholdTags = activeHousehold?.metadata?.tags || [];
      const tagsToAddToHousehold = tags.filter(t => !existingHouseholdTags.includes(t));
      
      for (const tag of tagsToAddToHousehold) {
        await addHouseholdTag(token, householdId, tag);
      }

      if (existingTemplate) {
        await updateTemplate(token, householdId, existingTemplate.id, data);
      } else {
        await createTemplate(token, householdId, data);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-lg relative flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <h2 className="text-xl font-semibold mb-4 flex-shrink-0">
          {existingTemplate ? "Edit Template" : "New Recurring Template"}
        </h2>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
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

          {transactionType === "EXPENSE" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {activeHousehold?.categories?.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                )) || (
                  <option value="Utilities">Utilities</option>
                )}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-col gap-2">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-2 py-1 flex items-center gap-1">
                      #{tag}
                      <button 
                        type="button"
                        className="flex items-center justify-center rounded-full hover:bg-muted p-0.5 transition-colors focus:outline-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTags(tags.filter((t) => t !== tag));
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        const normalizedTag = tagInput.trim().startsWith('#') ? tagInput.trim().substring(1) : tagInput.trim();
                        if (!tags.includes(normalizedTag)) {
                          setTags([...tags, normalizedTag]);
                        }
                        setTagInput("");
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    placeholder="Add a tag..."
                  />
                </div>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (tagInput.trim()) {
                      const normalizedTag = tagInput.trim().startsWith('#') ? tagInput.trim().substring(1) : tagInput.trim();
                      if (!tags.includes(normalizedTag)) {
                        setTags([...tags, normalizedTag]);
                      }
                      setTagInput("");
                    }
                    setTagInput("");
                  }}
                  disabled={!tagInput.trim()}
                >
                  Add
                </Button>
              </div>
              {activeHousehold?.metadata?.tags && activeHousehold.metadata.tags.filter(t => !tags.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {activeHousehold.metadata.tags
                    .filter(t => !tags.includes(t))
                    .map(t => (
                      <Badge 
                        key={t} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-muted text-xs font-normal"
                        onClick={() => setTags([...tags, t])}
                      >
                        + #{t}
                      </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {transactionType === "EXPENSE" && (
            <div className="border rounded-xl overflow-hidden mt-4">
              <div 
                className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer"
                onClick={() => setIsShared(!isShared)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isShared ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <SplitSquareHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Split this template</h3>
                    <p className="text-xs text-muted-foreground">Share this recurring cost with members</p>
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
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">Split Method</label>
                      <Tooltip>
                        <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-[200px] text-sm">
                            <strong>Equally:</strong> Divided evenly among members.<br/>
                            <strong>Percentage:</strong> You define the % each person pays.<br/>
                            <strong>Exact:</strong> You define the exact ₹ amount each person pays.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
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
                      This template will be split equally among all {members.length} members when posted.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
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
