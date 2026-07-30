"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";
import type { SaveStatus } from "@/lib/use-debounced-save";
import { cn } from "@/lib/utils";

/**
 * Tells the interviewer whether their notes have reached the server.
 *
 * Notes save on a debounce, which used to be entirely invisible: you could type
 * a detailed assessment, have the request fail, and never find out.
 */
export function SaveStatusIndicator({
  status,
  onRetry,
  className,
}: {
  status: SaveStatus;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <span
      data-testid="save-status"
      data-status={status}
      // Polite so it doesn't interrupt on every keystroke, but a screen reader
      // user still hears that a save failed.
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs tabular-nums",
        status === "error" ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-success" />
          Saved
        </>
      )}
      {status === "error" && (
        <>
          <TriangleAlert className="h-3.5 w-3.5" />
          Not saved
          <button
            type="button"
            onClick={onRetry}
            data-testid="save-retry"
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </>
      )}
      {/* `idle` renders nothing: a round you haven't touched shouldn't claim
          anything has been saved. */}
    </span>
  );
}
