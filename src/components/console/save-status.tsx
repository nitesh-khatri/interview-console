"use client";

import { Check, Loader2, RotateCcw } from "lucide-react";
import type { SaveStatus } from "@/lib/use-debounced-save";
import { Button } from "@/components/ui/button";

type SaveStatusIndicatorProps = {
  status: SaveStatus;
  onRetry: () => void | Promise<void>;
};

export function SaveStatusIndicator({
  status,
  onRetry,
}: SaveStatusIndicatorProps) {
  if (status === "idle") {
    return (
      <div
        data-testid="save-status"
        data-status="idle"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      />
    );
  }

  if (status === "saving") {
    return (
      <div
        data-testid="save-status"
        data-status="saving"
        aria-live="polite"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div
        data-testid="save-status"
        data-status="saved"
        aria-live="polite"
        className="flex items-center gap-1.5 text-sm text-success"
      >
        <Check className="h-3.5 w-3.5" />
        Saved
      </div>
    );
  }

  return (
    <div
      data-testid="save-status"
      data-status="error"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-destructive"
    >
      <span>Not saved</span>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="save-retry"
        onClick={onRetry}
        className="h-7 px-2 text-destructive hover:text-destructive"
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}