import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FAB() {
  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-primary text-primary-foreground"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add Expense</span>
      </Button>
    </div>
  );
}
