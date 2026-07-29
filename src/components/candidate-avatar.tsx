import { cn } from "@/lib/utils";

/**
 * The palette avatars pick from. Uses the theme's chart tokens so avatars stay
 * readable in all six themes instead of being hardcoded colours.
 */
const AVATAR_COLORS = [
  "bg-chart-1/20 text-chart-1",
  "bg-chart-2/20 text-chart-2",
  "bg-chart-3/20 text-chart-3",
  "bg-chart-4/20 text-chart-4",
  "bg-chart-5/20 text-chart-5",
] as const;

/** Up to two initials: "Nadia Fernandes" → "NF", "Cher" → "C". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Pick a palette index from the name. Deterministic, so a given person always
 * gets the same colour everywhere in the app — which is what makes an avatar
 * useful for scanning a list.
 */
export function colorIndexOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

export function CandidateAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      data-testid="candidate-avatar"
      title={name}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        SIZES[size],
        AVATAR_COLORS[colorIndexOf(name)],
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
