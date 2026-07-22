import Link from "next/link";
import { Home, List, PieChart, Settings, Wallet, Repeat } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-muted/40">
      <div className="flex h-14 items-center border-b px-6 font-semibold tracking-tight">
        Household Tracker
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="grid gap-1 px-4">
          <li>
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </li>
          <li>
            <Link
              href="/transactions"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <List className="h-4 w-4" />
              Transactions
            </Link>
          </li>
          <li>
            <Link
              href="/reports"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <PieChart className="h-4 w-4" />
              Reports
            </Link>
          </li>
          <li>
            <Link
              href="/budgets"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <Wallet className="h-4 w-4" />
              Budgets
            </Link>
            <Link
              href="/recurring"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <Repeat className="h-4 w-4" />
              Recurring
            </Link>
          </li>
          <li>
            <Link
              href="/households"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <Home className="h-4 w-4" />
              Households
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </li>
        </ul>
      </nav>
      <UserMenu />
    </aside>
  );
}
