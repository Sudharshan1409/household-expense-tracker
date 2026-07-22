import Link from "next/link";
import { Home, List, PieChart, Settings, Wallet } from "lucide-react";

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background pb-safe">
      <Link
        href="/"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <Home className="h-5 w-5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      <Link
        href="/transactions"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <List className="h-5 w-5" />
        <span className="text-[10px] font-medium">List</span>
      </Link>
      <div className="w-12" /> {/* Spacer for FAB */}
      <Link
        href="/reports"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <PieChart className="h-5 w-5" />
        <span className="text-[10px] font-medium">Reports</span>
      </Link>
      <Link
        href="/budgets"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <Wallet className="h-5 w-5" />
        <span className="text-[10px] font-medium">Budgets</span>
      </Link>
      <Link
        href="/households"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <Home className="h-5 w-5" />
        <span className="text-[10px] font-medium">Households</span>
      </Link>
      <Link
        href="/settings"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-medium">Settings</span>
      </Link>
    </nav>
  );
}
