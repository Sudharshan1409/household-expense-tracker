import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  trend?: any;
}

export function KPICard({ title, value, icon, description, trend }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend ? (
          <p className="text-xs text-muted-foreground mt-1">
            <span
              className={
                trend.isPositive ? "text-emerald-500" : "text-destructive"
              }
            >
              {trend.value}
            </span>{" "}
            {trend.label}
          </p>
        ) : description ? (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
