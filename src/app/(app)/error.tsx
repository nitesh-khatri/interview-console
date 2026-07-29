"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Catches render errors in the signed-in area so a single broken page doesn't
 * blank the whole app. `reset()` re-renders the segment, which is usually
 * enough to recover from a transient failure.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        This page failed to load. Trying again often fixes it — if it doesn&apos;t,
        send this message to whoever maintains the app.
      </p>
      {error.message && (
        <pre className="mb-6 max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
          {error.digest && `\n\nReference: ${error.digest}`}
        </pre>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
