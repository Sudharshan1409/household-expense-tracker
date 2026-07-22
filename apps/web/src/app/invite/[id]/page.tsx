"use client";

import { useEffect, useState, use } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { joinHousehold, getHousehold, getUserHouseholds } from "@/actions/household";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "success" | "error" | "already_member">("loading");
  const [householdName, setHouseholdName] = useState<string>("Loading...");
  const [budget, setBudget] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  
  // React 19: unwrap the params promise
  const resolvedParams = use(params);

  useEffect(() => {
    async function checkInvite() {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token) throw new Error("No token");

        const memberships = await getUserHouseholds(token);
        const isAlreadyMember = memberships.some((m: any) => m.householdId === resolvedParams.id);
        
        if (isAlreadyMember) {
          setStatus("already_member");
          return;
        }

        const metadata = await getHousehold(token, resolvedParams.id);
        if (metadata) {
          setHouseholdName(metadata.name);
          setStatus("ready");
        } else {
          throw new Error("Household does not exist");
        }
      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setErrorMsg(err.message || "Failed to load invite.");
      }
    }
    checkInvite();
  }, [resolvedParams.id]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;

    setStatus("joining");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No token");

      const parsedBudget = parseFloat(budget);
      if (isNaN(parsedBudget)) throw new Error("Invalid budget");

      await joinHousehold(token, resolvedParams.id, parsedBudget);
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to join household.");
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="max-w-md w-full p-8 bg-card border rounded-2xl shadow-lg text-center space-y-6">
        <h1 className="text-2xl font-bold">Household Invitation</h1>
        
        {status === "loading" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="text-muted-foreground">Loading invitation details...</p>
          </div>
        )}

        {status === "ready" || status === "joining" ? (
          <form onSubmit={handleJoin} className="space-y-6 text-left">
            <div className="text-center">
              <p className="text-muted-foreground">You have been invited to join</p>
              <h2 className="text-2xl font-bold mt-1 text-primary">{householdName}</h2>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="budget" className="text-sm font-medium leading-none">
                Your Monthly Budget (₹)
              </label>
              <input
                id="budget"
                type="number"
                step="0.01"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g. 50000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={status === "joining"}
              />
              <p className="text-xs text-muted-foreground">This is your personal budget. You can change this later.</p>
            </div>
            
            <Button type="submit" className="w-full" disabled={status === "joining" || !budget}>
              {status === "joining" ? "Joining..." : "Join Household"}
            </Button>
          </form>
        ) : null}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-lg">Successfully joined {householdName}!</p>
            <Button className="w-full mt-4" onClick={() => router.push("/")}>
              Go to Dashboard
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-medium text-lg">Failed to join</p>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Button variant="outline" className="w-full mt-4" onClick={() => router.push("/")}>
              Return Home
            </Button>
          </div>
        )}

        {status === "already_member" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-lg">You're already in!</p>
            <p className="text-muted-foreground text-sm">You are already a member of this household.</p>
            <Button className="w-full mt-4" onClick={() => router.push("/")}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
