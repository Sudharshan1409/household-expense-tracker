"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Settings, Users, Edit3, Trash2, Shield, User } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getHouseholdMembers, updateHouseholdSettings, updateMemberBudget, removeMember, changeMemberRole, updateMemberName } from "@/actions/household";
import { CategoriesManager } from "@/components/settings/categories-manager";

interface ManageHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: any; // Context household which has householdId, role, name, monthlyBudget
  onSuccess: () => void;
}

export function ManageHouseholdModal({ isOpen, onClose, household, onSuccess }: ManageHouseholdModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "members">("general");
  const [name, setName] = useState(household?.name || "");
  const [budget, setBudget] = useState(household?.monthlyBudget || 50000);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBudgetLoading, setIsBudgetLoading] = useState(false);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  
  const [userName, setUserName] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const isOwner = household?.role === "OWNER";

  const fetchMembers = async () => {
    setIsFetchingMembers(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const payloadBase64 = token?.split('.')[1];
      let currentUserId = "";
      if (payloadBase64) {
        currentUserId = JSON.parse(atob(payloadBase64)).sub;
      }
      
      if (token && household?.householdId) {
        const data = await getHouseholdMembers(token, household.householdId);
        setMembers(data);
        const me = data.find((m: any) => m.userId === currentUserId);
        if (me?.userName) setUserName(me.userName);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  useEffect(() => {
    setName(household?.name || "");
    setBudget(household?.monthlyBudget || 50000);
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen, household]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        // We leave the household-level budget alone for backward compatibility
        await updateHouseholdSettings(token, household.householdId, { name, monthlyBudget: 50000 });
        onSuccess();
        alert("Household renamed successfully.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to rename household");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBudgetLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await updateMemberBudget(token, household.householdId, Number(budget));
        onSuccess(); // Triggers a context refetch
        alert("Personal budget updated!");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save personal budget");
    } finally {
      setIsBudgetLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsProfileLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await updateMemberName(token, household.householdId, userName);
        alert("Display name updated!");
        fetchMembers();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update name");
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: "OWNER" | "ADMIN" | "MEMBER") => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await changeMemberRole(token, household.householdId, targetUserId, newRole);
        fetchMembers();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to change role.");
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the household?")) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await removeMember(token, household.householdId, targetUserId);
        fetchMembers();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to remove member.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-lg sm:rounded-2xl relative slide-in-from-bottom-4 duration-300 flex flex-col max-h-[85vh]">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold tracking-tight">Manage Household</h2>
          <p className="text-sm text-muted-foreground">{household?.name}</p>
        </div>

        <div className="flex border-b px-6 flex-shrink-0">
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "general" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("general")}
          >
            General
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "members" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("members")}
          >
            Members <span className="bg-muted text-xs px-2 py-0.5 rounded-full">{members.length || 0}</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "general" && (
            <div className="space-y-8">
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Household Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">Manage shared details for this household.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Household Name</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isOwner && household?.role !== "ADMIN"}
                  />
                </div>

                {(isOwner || household?.role === "ADMIN") && (
                  <div className="pt-2">
                    <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                      {isLoading ? "Saving..." : "Rename Household"}
                    </Button>
                  </div>
                )}
                
                {(!isOwner && household?.role !== "ADMIN") && (
                  <p className="text-xs text-muted-foreground pt-2">Only Admins and Owners can rename the household.</p>
                )}
              </form>
              
              <hr />

              <form onSubmit={handleUpdateBudget} className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Personal Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">Set your own personal monthly budget for expenses in this household.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">My Monthly Budget (₹)</label>
                  <input
                    type="number"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="secondary" disabled={isBudgetLoading} className="w-full sm:w-auto">
                    {isBudgetLoading ? "Saving..." : "Save Personal Budget"}
                  </Button>
                </div>
              </form>

              <hr />

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <input
                    type="text"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={isProfileLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is how other members of this household will see you.
                  </p>
                </div>
                <div className="pt-2">
                  <Button type="submit" variant="secondary" disabled={isProfileLoading || !userName}>
                    {isProfileLoading ? "Saving..." : "Save Display Name"}
                  </Button>
                </div>
              </form>

              <hr />
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Custom Categories
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Manage shared categories for this household.</p>
                </div>
                <CategoriesManager />
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <div className="space-y-6">
              {(isOwner || household?.role === "ADMIN") && (
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 space-y-2">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Invite Members
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Share this link with your family or roommates to join this household.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 bg-background border px-3 py-2 rounded-md font-mono text-xs sm:text-sm truncate select-all">
                      {typeof window !== "undefined" ? `${window.location.origin}/invite/${household?.householdId}` : ""}
                    </code>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const inviteLink = `${window.location.origin}/invite/${household?.householdId}`;
                        navigator.clipboard.writeText(inviteLink);
                        alert("Invite link copied to clipboard!");
                      }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
              )}

              {isFetchingMembers ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
                </div>
              ) : (
                <div className="divide-y border rounded-xl bg-card">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                          {(m.userName || m.userId).substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{m.userName || "Unknown User"}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.userEmail || `ID: ${m.userId.substring(0, 8)}...`}</p>
                          <div className="flex items-center gap-1 text-xs font-medium mt-1">
                            {m.role === "OWNER" ? <Shield className="w-3 h-3 text-amber-500" /> : <User className="w-3 h-3 text-muted-foreground" />}
                            <span className={m.role === "OWNER" ? "text-amber-500" : "text-muted-foreground"}>{m.role}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isOwner && m.role !== "OWNER" && (
                        <div className="flex items-center gap-2">
                          <select
                            className="text-xs border rounded-md px-2 py-1 bg-background"
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value as any)}
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(m.userId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
