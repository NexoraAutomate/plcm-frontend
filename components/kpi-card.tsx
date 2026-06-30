"use client";

import { type LucideIcon, TrendingUp, TrendingDown, TrendingUpDown, Ellipsis   } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  accentColor: "blue" | "green" | "red" | "amber" | "orange" | "slate" | "emerald";
  isSelected?: boolean;
}

const accentStyles = {
  blue: "border-l-blue-500 dark:border-l-blue-400",
  green: "border-l-emerald-500 dark:border-l-emerald-400",
  red: "border-l-red-500 dark:border-l-red-400",
  amber: "border-l-amber-500 dark:border-l-amber-400",
  orange: "border-l-orange-500 dark:border-l-orange-400",
  slate: "border-l-slate-500 dark:border-l-slate-400",
  emerald: "border-l-emerald-500 dark:emerald-l-emerald-400",
};
const selectedAccentStyles = {
  blue: "border-4 border-blue-500 dark:border-4 border-blue-400",
  green: "border-4 border-emerald-500 dark:border-4 border-emerald-400",
  red: "border-4 border-red-500 dark:border-4 border-red-400",
  amber: "border-4 border-amber-500 dark:border-4 border-amber-400",
  orange: "border-4 border-orange-500 dark:border-4 border-orange-400",
  slate: "border-4 border-slate-500 dark:border-4 border-slate-400",
  emerald: "border-4 border-emerald-500 dark:emerald-l-emerald-400",
};
const glowStyles = {
  blue: "ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20",
  amber: "ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20",
  emerald: "ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20",
  orange: "ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20",
  green: "ring-2 ring-green-500/50 shadow-lg shadow-green-500/20",
  slate: "ring-2 ring-slate-500/50 shadow-lg shadow-slate-500/20",
  red: "ring-2 ring-red-500/50 shadow-lg shadow-red-500/20",
} as const;

const iconBgStyles = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-400",
};

export function KPICard({ title, value, change, icon: Icon, accentColor,  isSelected = false }: KPICardProps) {
  const isPositive = change > 0;

  return (
    <Card
  className={cn(
    "h-full shadow-sm transition-all duration-200",
    accentStyles[accentColor],
    isSelected ?
      `shadow-lg scale-[1.02] ${glowStyles[accentColor]}`
      :
      `border-l-4 ${accentStyles[accentColor]}`
  )}
>
      <CardContent className="flex items-center justify-between p-5 h-28">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
          <div className="flex items-center gap-1">
            {change > 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ):
            change == 0 ?  (<Ellipsis  className="h-3 w-3 text-blue-500" />)
            : 
            ( 
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                change > 0 ? "text-emerald-600 dark:text-emerald-400" : change == 0? "text-blue-600  dark:text-blue-400": "text-red-600 dark:text-red-400"
              )}
            >
              {change > 0 ? `+${change}%` : ""}
            </span>
          </div>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBgStyles[accentColor])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
 