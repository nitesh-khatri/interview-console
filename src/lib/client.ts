export async function api<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers:
      options?.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : undefined,
    ...options,
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : null;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? (data as { error: string }).error
        : null) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

/**
 * Copy text to the clipboard, returning whether it worked.
 *
 * `navigator.clipboard` only exists in a secure context, and this app is
 * commonly self-hosted over plain HTTP on an internal IP (see DEPLOYMENT.md),
 * so we fall back to a hidden textarea + execCommand there.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Absolute URL for a path. Call from an event handler, never during render. */
export function absoluteUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

export function fmtDate(value: string | null): string {
  if (!value) return "—";
  // SQLite stores UTC 'YYYY-MM-DD HH:MM:SS'; normalize to ISO for the Date parser.
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Parse a SQLite `YYYY-MM-DD HH:MM:SS` (UTC) or ISO timestamp. */
export function parseTimestamp(value: string): Date {
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  return new Date(iso);
}

/**
 * Human-friendly elapsed time: "just now", "5 minutes ago", "3 days ago".
 * Falls back to an absolute date beyond a month, where "37 days ago" stops
 * being easier to read than the date itself.
 */
export function fmtRelative(value: string | null, now: Date = new Date()): string {
  if (!value) return "—";
  const d = parseTimestamp(value);
  if (isNaN(d.getTime())) return value;

  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 0) return fmtDate(value); // clock skew — don't say "in -3 days"
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.round(seconds / 3600);
  if (hours < 24) return plural(hours, "hour");
  const days = Math.round(seconds / 86400);
  if (days <= 30) return plural(days, "day");
  return fmtDate(value);
}

/**
 * Formats an elapsed duration in seconds as a clock: `mm:ss`, or `h:mm:ss` once
 * it passes an hour. Kept pure and separate from the ticking component so the
 * formatting can be tested without a clock (ticket #25).
 */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * How long a round took (completed) or has been running (in progress), in
 * seconds — or null when there's nothing sensible to show. A completed round
 * with no `completed_at` (older data) falls back to null rather than counting
 * up to "now" forever.
 */
export function roundDurationSeconds(
  status: string,
  startedAt: string | null,
  completedAt: string | null,
  now: Date = new Date()
): number | null {
  if (!startedAt || status === "pending") return null;
  const start = parseTimestamp(startedAt).getTime();
  if (isNaN(start)) return null;

  if (status === "completed") {
    if (!completedAt) return null;
    const end = parseTimestamp(completedAt).getTime();
    if (isNaN(end)) return null;
    return Math.max(0, Math.round((end - start) / 1000));
  }
  return Math.max(0, Math.round((now.getTime() - start) / 1000));
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
