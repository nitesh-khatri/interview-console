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




/**
 * Format a timestamp as relative time.
 *
 * Returns human-friendly text for recent timestamps:
 * - < 45 seconds: "just now"
 * - < 1 hour: "X minute(s) ago"
 * - < 1 day: "X hour(s) ago"
 * - ≤ 30 days: "X day(s) ago"
 * - > 30 days: falls back to fmtDate()
 *
 * Accepts both ISO timestamps and SQLite UTC timestamps
 * ("YYYY-MM-DD HH:MM:SS"). The optional `now` parameter allows
 * callers (and tests) to provide a fixed reference time.
 */
export function fmtRelative(
  value: string | null,
  now?: Date
): string {
  if (!value) return "—";

  // SQLite stores UTC as "YYYY-MM-DD HH:MM:SS". Normalize it to
  // ISO-8601 so JavaScript parses it as UTC.
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(iso);

  // Preserve the original value if it isn't a valid date.
  if (isNaN(date.getTime())) return value;

  // Allow tests to inject a fixed "current" time.
  const current = now ?? new Date();

  // Clamp negative values so future timestamps don't produce
  // messages like "in -3 days".
  const diffMs = Math.max(0, current.getTime() - date.getTime());

  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 45) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days <= 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  // Older timestamps are shown as calendar dates.
  return fmtDate(value);
}