import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const cleaned = name.trim();

  if (!cleaned) return "?";

  const parts = cleaned.split(/\s+/);

  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
}

export function colorIndexOf(name: string): number {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = hash * 31 + name.charCodeAt(i);
  }

  return Math.abs(hash) % 5;
}

const colorClasses = [
  "bg-chart-1 text-primary-foreground",
  "bg-chart-2 text-primary-foreground",
  "bg-chart-3 text-primary-foreground",
  "bg-chart-4 text-primary-foreground",
  "bg-chart-5 text-primary-foreground",
];

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

type CandidateAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
};

export function CandidateAvatar({
  name,
  size = "md",
}: CandidateAvatarProps) {
  const initials = initialsOf(name);
  const color = colorClasses[colorIndexOf(name)];

  return (
    <div
      data-testid="candidate-avatar"
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        color,
        sizeClasses[size]
      )}
    >
      {initials}
    </div>
  );
}