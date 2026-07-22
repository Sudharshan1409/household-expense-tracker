import { Loader2 } from "lucide-react";

export function PageLoader({ title = "Loading data..." }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
        <Loader2 className="h-12 w-12 text-primary animate-spin relative z-10" />
      </div>
      <p className="text-muted-foreground animate-pulse font-medium">{title}</p>
    </div>
  );
}
