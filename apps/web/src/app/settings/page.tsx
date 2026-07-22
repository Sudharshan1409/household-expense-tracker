"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/providers/household-provider";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { CategoriesManager } from "@/components/settings/categories-manager";
import { Button } from "@/components/ui/button";
import { User, Settings as SettingsIcon } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { getHouseholdMembers, updateMemberName } from "@/actions/household";

export default function SettingsPage() {
  const { activeHousehold, currentUserId } = useHousehold();
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (!activeHousehold?.householdId || !currentUserId) return;
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          const mems = await getHouseholdMembers(token, activeHousehold.householdId);
          const me = mems.find(m => m.userId === currentUserId);
          if (me) {
            setUserName(me.userName || "");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadUser();
  }, [activeHousehold?.householdId, currentUserId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHousehold?.householdId) return;
    
    setIsLoading(true);
    setIsSuccess(false);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      await updateMemberName(token, activeHousehold.householdId, userName);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to update name");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your personal profile and preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher />
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Personal Details</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <input
                type="text"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                This is how other members of this household will see you.
              </p>
            </div>

            <Button type="submit" disabled={isLoading || !userName}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
            
            {isSuccess && (
              <span className="ml-4 text-sm text-emerald-500 font-medium animate-in fade-in">
                Successfully updated!
              </span>
            )}
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            Custom Categories
          </h2>
          <CategoriesManager />
        </Card>
      </div>
    </div>
  );
}
