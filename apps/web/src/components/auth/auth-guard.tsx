"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useRouter, usePathname } from "next/navigation";
import { getUserHouseholds } from "@/actions/household";
import { toast } from "sonner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Do not guard authentication routes
    if (pathname.startsWith("/auth")) {
      setIsAuthenticated(true);
      return;
    }
    checkAuth();

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "signInWithRedirect") {
        checkAuth();
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  async function checkAuth() {
    try {
      await getCurrentUser();
      
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          const households: any = await getUserHouseholds(idToken);
          if (households?.error === "Unauthorized") {
            console.error("User is unauthorized:", households.details);
            toast.error(`Unauthorized: ${households.details}`, { duration: 10000 });
            setIsAuthenticated(false);
            await signOut().catch(() => {});
            if (typeof window !== "undefined") {
              setTimeout(() => router.replace("/auth/login"), 3000);
            }
            return;
          }
          if (households?.error === "Database error") {
            // DB is down or credentials expired, stay on page but show error state or just let the app render its own errors
            setIsAuthenticated(true);
            return;
          }
          if (Array.isArray(households) && households.length === 0 && !pathname.startsWith("/onboarding") && !pathname.startsWith("/invite")) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check households", err);
      }

      setIsAuthenticated(true);
    } catch (err: any) {
      if (err?.name !== "UserUnAuthenticatedException") {
        console.error("getCurrentUser failed", err);
      }
      setIsAuthenticated(false);
      // Wait for oauth redirects to clear before aggressive routing
      if (typeof window !== "undefined" && !window.location.search.includes("code=")) {
        if (err?.name !== "UserUnAuthenticatedException") {
          toast.error(`Session Error: ${err?.message || err?.name || 'Unknown'}`, { duration: 10000 });
          setTimeout(() => router.replace("/auth/login"), 3000);
        } else {
          router.replace("/auth/login");
        }
      }
    }
  }

  if (isAuthenticated === null) {
    // Show nothing or a subtle loading state while checking
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated === false && !pathname.startsWith("/auth")) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
