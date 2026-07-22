"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { useRouter, usePathname } from "next/navigation";
import { getUserHouseholds } from "@/actions/household";

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
  }, [pathname]);

  async function checkAuth() {
    try {
      await getCurrentUser();
      
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          const households = await getUserHouseholds(idToken);
          if (households.length === 0 && !pathname.startsWith("/onboarding") && !pathname.startsWith("/invite")) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check households", err);
      }

      setIsAuthenticated(true);
    } catch (err) {
      setIsAuthenticated(false);
      // Wait for oauth redirects to clear before aggressive routing
      if (typeof window !== "undefined" && !window.location.search.includes("code=")) {
        router.replace("/auth/login");
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
