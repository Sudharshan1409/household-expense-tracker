"use client";

import { useState, useEffect } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { Repeat, Plus, Play, Trash2, Edit2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchAuthSession } from "aws-amplify/auth";
import { getTemplates, deleteTemplate } from "@/actions/recurring";
import { createTransaction } from "@/actions/transaction";
import { TemplateModal } from "@/components/recurring/recurring-modal";
import { toast } from "sonner";

export default function RecurringPage() {
  const { activeHousehold, currentUserId, isLoading: isHouseholdLoading } = useHousehold();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const loadTemplates = async () => {
    if (!activeHousehold?.householdId) return;
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const data = await getTemplates(token, activeHousehold.householdId);
        setTemplates(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [activeHousehold?.householdId]);

  const handlePostNow = async (template: any) => {
    if (!activeHousehold?.householdId || !currentUserId) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      await createTransaction(token, activeHousehold.householdId, {
        amount: template.amount,
        description: template.description,
        category: template.category,
        transactionType: template.transactionType || "EXPENSE",
        isShared: false,
        splitType: "NONE",
        splits: { [currentUserId]: template.amount },
        date: new Date().toISOString(),
        paidBy: currentUserId
      });
      toast(`Success! Generated transaction for ${template.description}.`);
    } catch (e) {
      console.error(e);
      toast("Failed to post transaction.");
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!activeHousehold?.householdId || !confirm("Delete this template?")) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await deleteTemplate(token, activeHousehold.householdId, templateId);
        loadTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-muted-foreground">
            Manage your smart templates for subscriptions and bills.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setEditingTemplate(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="space-y-4">
          {isHouseholdLoading || isLoading ? (
            <PageLoader title="Loading recurring expenses..." />
          ) : templates.length === 0 ? (
             <EmptyState
              icon={<Repeat className="h-10 w-10 text-muted-foreground" />}
              title="No templates yet"
              description="Create recurring templates for things like rent and utilities."
            />
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-full">
                    <Repeat className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tpl.description}</h3>
                    <p className="text-sm text-muted-foreground">
                      ₹{tpl.amount} • {tpl.category} • <span className={tpl.transactionType === "INCOME" ? "text-emerald-500" : ""}>{tpl.transactionType || "EXPENSE"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingTemplate(tpl); setIsModalOpen(true); }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePostNow(tpl)}>
                    <Play className="mr-2 h-4 w-4" />
                    Post Now
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <TemplateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        householdId={activeHousehold?.householdId || ""}
        onSuccess={loadTemplates}
        existingTemplate={editingTemplate}
      />
    </div>
  );
}
