"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function AppErrorState({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />

      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The signed-in area hit an unexpected problem. You can try again and
        reload the current view.
      </p>
      {error.message ? (
        <p className="mt-2 max-w-md text-xs text-muted-foreground/80">
          {error.message}
        </p>
      ) : null}

      <Button className="mt-6" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

export default function Error({ error, reset }: ErrorProps) {
  return <AppErrorState error={error} reset={reset} />;
}
