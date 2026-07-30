"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

/**
 * A per-user star toggle for a question. Optimistic, with rollback on failure
 * (ticket #13's principle) — and a real toggle button with a state-dependent
 * accessible name, not a bare icon.
 */
export function FavoriteStar({
  questionId,
  initialFavorite,
  size = "sm",
}: {
  questionId: number;
  initialFavorite: boolean;
  size?: "sm" | "md";
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !favorite;
    setFavorite(next); // optimistic
    setBusy(true);
    try {
      await api(`/api/questions/${questionId}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
    } catch (e) {
      setFavorite(!next); // roll back
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <button
      type="button"
      onClick={toggle}
      data-testid={`favorite-${questionId}`}
      aria-pressed={favorite}
      aria-label={favorite ? "Unstar this question" : "Star this question"}
      className={cn(
        "shrink-0 rounded p-1 transition-colors",
        favorite
          ? "text-warning hover:text-warning/80"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Star className={cn(dim, favorite && "fill-current")} />
    </button>
  );
}
