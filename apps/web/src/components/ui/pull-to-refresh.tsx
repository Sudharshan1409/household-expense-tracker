"use client";

import React from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { mutate } from "swr";

export function PullToRefreshWrapper({ children }: { children: React.ReactNode }) {
  const handleRefresh = async () => {
    // Revalidate all SWR queries
    await mutate(() => true, undefined, { revalidate: true });
  };

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      pullingContent={
        <div className="flex justify-center p-4">
          <span className="text-sm text-muted-foreground animate-pulse">Pull to refresh...</span>
        </div>
      }
      refreshingContent={
        <div className="flex justify-center p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      }
      className="min-h-full"
    >
      {children}
    </PullToRefresh>
  );
}
