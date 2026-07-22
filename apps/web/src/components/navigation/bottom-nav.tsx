"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, PieChart, Settings, Wallet, LineChart, MoreHorizontal, Repeat, Users } from "lucide-react";
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
        href="/households"
        className={`flex flex-col items-center justify-center gap-1 ${pathname === "/households" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}
      >
        <Users className="h-5 w-5" />
        <span className="text-[10px] font-medium">Households</span>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[auto] rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">More Options</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/reports"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-muted hover:text-primary border"
            >
              <PieChart className="h-5 w-5" />
              <span className="font-medium">Reports</span>
            </Link>
            
            <Link
              href="/savings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-muted hover:text-primary border"
            >
              <LineChart className="h-5 w-5" />
              <span className="font-medium">Savings</span>
            </Link>
            
            <Link
              href="/budgets"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-muted hover:text-primary border"
            >
              <Wallet className="h-5 w-5" />
              <span className="font-medium">Budgets</span>
            </Link>
            
            <Link
              href="/recurring"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-muted hover:text-primary border"
            >
              <Repeat className="h-5 w-5" />
              <span className="font-medium">Recurring</span>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
