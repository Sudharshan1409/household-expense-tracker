"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();

    let pollCount = 0;
    let pollInterval: NodeJS.Timeout;
    if (typeof window !== "undefined" && window.location.search.includes("code=")) {
      pollInterval = setInterval(() => {
        pollCount++;
        checkUser();
        // Give up after 10 seconds (10 polls)
        if (pollCount > 10) {
          clearInterval(pollInterval);
          setIsLoading(false);
          console.error("Gave up waiting for OAuth code exchange.");
        }
      }, 1000);
    }

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      console.log("Auth Hub Event:", payload.event, payload.data);
      switch (payload.event) {
        case "signIn":
        case "signInWithRedirect":
          if (pollInterval) clearInterval(pollInterval);
          // Manually clear the URL of OAuth parameters in Next.js App Router
          router.replace(window.location.pathname);
          checkUser();
          break;
        case "signInWithRedirect_failure":
          console.error("OAuth Redirect Failure:", payload.data);
          setIsLoading(false);
          break;
        case "signOut":
          setUser(null);
          setName("");
          setIsLoading(false);
          break;
      }
    });

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      try {
        const session = await fetchAuthSession();
        const payload = session.tokens?.idToken?.payload;
        
        if (payload) {
          const displayName = payload.given_name 
            ? `${payload.given_name} ${payload.family_name || ""}`.trim() 
            : payload.email || currentUser.username;
          setName(displayName as string);
        } else {
          setName(currentUser.username);
        }
      } catch (attrError) {
        console.error("Could not fetch session payload", attrError);
        setName(currentUser.username);
      }
      setIsLoading(false);
    } catch (err) {
      setUser(null);
      setName("");
      // Only stop loading if we are not actively in an OAuth redirect flow
      if (typeof window !== "undefined" && !window.location.search.includes("code=")) {
        setIsLoading(false);
      }
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border-t flex items-center justify-between gap-2 opacity-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 border-t">
        <Link href="/auth/login">
          <Button className="w-full">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 border-t flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{name || "User"}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={handleSignOut} title="Log out">
        <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
