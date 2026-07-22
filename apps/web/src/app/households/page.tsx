"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getUserHouseholds, getHousehold, leaveHousehold, deleteHousehold } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Home, Users, UserPlus, LogOut, Trash2, Settings as SettingsIcon } from "lucide-react";
import { ManageHouseholdModal } from "@/components/household/manage-household-modal";

export default function SettingsPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for the modal
  const [activeHousehold, setActiveHousehold] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    alert("Invite link copied to clipboard!");
  };

  const handleLeave = async (householdId: string) => {
    if (!confirm("Are you sure you want to leave this household?")) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await leaveHousehold(token, householdId);
        loadData();
      }
    } catch (error) {
      console.error("Failed to leave", error);
      alert("Failed to leave household.");
    }
  };

  const handleDelete = async (householdId: string) => {
    if (!confirm("Are you SURE you want to permanently delete this household and ALL its transactions?")) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await deleteHousehold(token, householdId);
        loadData();
      }
    } catch (error: any) {
      console.error("Failed to delete", error);
      alert(error.message || "Failed to delete household.");
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
          <div className="animate-pulse h-32 bg-muted rounded-xl" />
        ) : (
          <div className="grid gap-4">
            {households.map((hh) => (
              <div key={hh.householdId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-card border rounded-xl shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{hh.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Role: {hh.role}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Active</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap w-full sm:w-auto gap-2">
                  <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => handleCopyInvite(hh.householdId)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { setActiveHousehold(hh); setIsModalOpen(true); }} title="Manage Household">
                    <SettingsIcon className="w-4 h-4 mr-2 md:mr-0" />
                    <span className="md:hidden">Manage</span>
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => handleLeave(hh.householdId)} title="Leave Household">
                    <LogOut className="w-4 h-4 mr-2 md:mr-0" />
                    <span className="md:hidden">Leave</span>
                  </Button>
                  {hh.role === "OWNER" && (
                    <Button variant="outline" className="flex-1 sm:flex-none text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={() => handleDelete(hh.householdId)} title="Delete Household">
                      <Trash2 className="w-4 h-4 mr-2 md:mr-0" />
                      <span className="md:hidden">Delete</span>
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
    </div>
  );
}
