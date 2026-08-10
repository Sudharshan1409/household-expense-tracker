"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, PieChart, Settings, Wallet, LineChart, MoreHorizontal, Repeat, Users, Hash, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/onboarding" || pathname.startsWith("/auth") || pathname.startsWith("/invite")) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background pb-safe">
      <Link
        href="/"
        className={`flex flex-col items-center justify-center gap-1 ${pathname === "/" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}
      >
        <Home className="h-5 w-5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      
      <Link
        href="/transactions"
        className={`flex flex-col items-center justify-center gap-1 ${pathname === "/transactions" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}
      >
        <List className="h-5 w-5" />
        <span className="text-[10px] font-medium">List</span>
      </Link>
      
      <Link
        href="/budgets"
        className={`flex flex-col items-center justify-center gap-1 ${pathname === "/budgets" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}
      >
        <Wallet className="h-5 w-5" />
        <span className="text-[10px] font-medium">Budgets</span>
      </Link>
      
      <Link
        href="/recurring"
        className={`flex flex-col items-center justify-center gap-1 ${pathname === "/recurring" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}
      >
        <Repeat className="h-5 w-5" />
        <span className="text-[10px] font-medium">Recurring</span>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary">
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[auto] rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left">More Options</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            <Link
              href="/reports"
              onClick={() => setOpen(false)}
              className="group relative flex items-center gap-4 rounded-2xl p-4 overflow-hidden border border-border/50 bg-card/50 hover:bg-card hover:shadow-md hover:border-primary/50 transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <PieChart className="h-6 w-6" />
              </div>
              <div className="flex flex-col relative z-10 flex-1">
                <span className="font-semibold text-foreground">Reports</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Analytics & spending insights</span>
              </div>
              <ChevronRight className="relative z-10 h-5 w-5 text-muted-foreground opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
            </Link>

            <Link
              href="/tags"
              onClick={() => setOpen(false)}
              className="group relative flex items-center gap-4 rounded-2xl p-4 overflow-hidden border border-border/50 bg-card/50 hover:bg-card hover:shadow-md hover:border-emerald-500/50 transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Hash className="h-6 w-6" />
              </div>
              <div className="flex flex-col relative z-10 flex-1">
                <span className="font-semibold text-foreground">Tags</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Manage custom categories</span>
              </div>
              <ChevronRight className="relative z-10 h-5 w-5 text-muted-foreground opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-emerald-500" />
            </Link>
            
            <Link
              href="/savings"
              onClick={() => setOpen(false)}
              className="group relative flex items-center gap-4 rounded-2xl p-4 overflow-hidden border border-border/50 bg-card/50 hover:bg-card hover:shadow-md hover:border-blue-500/50 transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <LineChart className="h-6 w-6" />
              </div>
              <div className="flex flex-col relative z-10 flex-1">
                <span className="font-semibold text-foreground">Savings Goals</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Track your milestones</span>
              </div>
              <ChevronRight className="relative z-10 h-5 w-5 text-muted-foreground opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-blue-500" />
            </Link>
            
            <Link
              href="/households"
              onClick={() => setOpen(false)}
              className="group relative flex items-center gap-4 rounded-2xl p-4 overflow-hidden border border-border/50 bg-card/50 hover:bg-card hover:shadow-md hover:border-purple-500/50 transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex flex-col relative z-10 flex-1">
                <span className="font-semibold text-foreground">Households</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Switch or manage families</span>
              </div>
              <ChevronRight className="relative z-10 h-5 w-5 text-muted-foreground opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-purple-500" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
