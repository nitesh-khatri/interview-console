"use client";

import { fmtDateTime, fmtRelative } from "@/lib/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Shows how long ago something happened ("3 days ago") with the exact
 * date and time on hover or focus.
 *
 * Rendered inside a <time> element so the machine-readable timestamp is in the
 * markup even though the visible text is relative.
 */
export function RelativeTime({
  value,
  className,
}: {
  value: string | null;
  className?: string;
}) {
  if (!value) return <span className={className}>—</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          data-testid="relative-time"
          dateTime={value}
          className={className}
          tabIndex={0}
        >
          {fmtRelative(value)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{fmtDateTime(value)}</TooltipContent>
    </Tooltip>
  );
}
