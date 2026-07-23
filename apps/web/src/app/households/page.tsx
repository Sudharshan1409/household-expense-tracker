"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getUserHouseholds, getHousehold, leaveHousehold, deleteHousehold } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Home, Users, UserPlus, LogOut, Trash2, Settings as SettingsIcon } from "lucide-react";
import { ManageHouseholdModal } from "@/components/household/manage-household-modal";
import { PageLoader } from "@/components/ui/page-loader";
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
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for the modal
  const [activeHousehold, setActiveHousehold] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [pendingLeave, setPendingLeave] = useState<any>(null);
  const [pendingDelete, setPendingDelete] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const memberships = await getUserHouseholds(token);
        
        // Fetch metadata for each household
        const detailedHouseholds = await Promise.all(
          memberships.map(async (m: any) => {
            const meta = await getHousehold(token, m.householdId);
            return { ...m, name: meta?.name || "Unknown Household", inviteCode: meta?.inviteCode || "UNKNOWN" };
          })
        );
        
        setHouseholds(detailedHouseholds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyInvite = (householdId: string) => {
    const inviteLink = `${window.location.origin}/invite/${householdId}`;
    navigator.clipboard.writeText(inviteLink);
    toast("Invite link copied to clipboard!");
  };

  const executeLeave = async () => {
    if (!pendingLeave) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await leaveHousehold(token, pendingLeave.householdId);
        toast("Left household successfully.");
        loadData();
      }
    } catch (error) {
      console.error("Failed to leave", error);
      toast("Failed to leave household.");
    } finally {
      setPendingLeave(null);
    }
  };

  const executeDelete = async () => {
    if (!pendingDelete) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await deleteHousehold(token, pendingDelete.householdId);
        toast("Household deleted.");
        loadData();
      }
    } catch (error: any) {
      console.error("Failed to delete", error);
      toast(error.message || "Failed to delete household.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Households</h1>
        <p className="text-muted-foreground">Manage your households and preferences.</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Home className="w-5 h-5" /> Your Households
          </h2>
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/onboarding'}>
            Create New
          </Button>
        </div>

        {isLoading ? (
          <PageLoader title="Loading your households..." />
        ) : (
          <div className="grid gap-4">
            {households.map((hh) => (
              <div key={hh.householdId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-card border rounded-xl shadow-sm gap-4">
                <div className="w-full sm:w-auto">
                  <h3 className="text-lg font-semibold">{hh.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Role: {hh.role}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Active</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2">
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleCopyInvite(hh.householdId)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setActiveHousehold(hh); setIsModalOpen(true); }} title="Manage Household">
                    <SettingsIcon className="w-4 h-4 sm:mr-2" />
                    <span className="ml-2 sm:ml-0">Manage</span>
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPendingLeave(hh)} title="Leave Household">
                    <LogOut className="w-4 h-4 sm:mr-2" />
                    <span className="ml-2 sm:ml-0">Leave</span>
                  </Button>
                  {hh.role === "OWNER" && (
                    <Button variant="outline" className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={() => setPendingDelete(hh)} title="Delete Household">
                      <Trash2 className="w-4 h-4 sm:mr-2" />
                      <span className="ml-2 sm:ml-0">Delete</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {households.length === 0 && (
              <div className="text-center p-8 border rounded-xl bg-muted/20 text-muted-foreground">
                You are not a member of any households.
              </div>
            )}
          </div>
        )}
      </div>

      <ManageHouseholdModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        household={activeHousehold}
        onSuccess={() => { setIsModalOpen(false); loadData(); }}
      />
      
      {/* Confirmation Dialogs */}
      <AlertDialog open={!!pendingLeave} onOpenChange={(open) => !open && setPendingLeave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Household</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <strong>{pendingLeave?.name}</strong>? You will lose access to all its data and settings immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Household</AlertDialogTitle>
            <AlertDialogDescription>
              Are you <strong>absolutely sure</strong> you want to permanently delete <strong>{pendingDelete?.name}</strong> and <strong>ALL</strong> its transactions? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
