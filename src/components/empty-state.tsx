import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dashed-border "there's nothing here yet" panel used across the app.
 *
 * Every empty state should say what's missing, why the user might be seeing it,
 * and — where there is one — offer the action that fixes it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mb-4 mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
