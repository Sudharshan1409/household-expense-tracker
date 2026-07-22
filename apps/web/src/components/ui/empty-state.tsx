import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = <Inbox className="h-10 w-10 text-muted-foreground" />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-[250px] shrink-0 items-center justify-center rounded-md border border-dashed">
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
