"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface Command {
  key: string;
  label: string;
  group: string;
  run: () => void;
}

/**
 * A ⌘K command palette (ticket #22): jump to a candidate, a page, or switch
 * theme. Mounted once in the app shell.
 */
export function CommandPalette({
  candidates,
  canEditBank,
}: {
  candidates: { id: number; name: string }[];
  canEditBank: boolean;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K opens from anywhere — but never while the user is typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        const typing =
          t instanceof HTMLElement &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable);
        if (typing) return;
        e.preventDefault(); // or Firefox jumps to its search bar
        // Always start from a clean query. Reset here rather than in an effect
        // on `open`, which would be setState-in-effect.
        setQuery("");
        setActive(0);
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { key: "nav-dashboard", label: "Dashboard", group: "Go to", run: () => router.push("/dashboard") },
      { key: "nav-candidates", label: "Candidates", group: "Go to", run: () => router.push("/candidates") },
      ...(canEditBank
        ? [{ key: "nav-bank", label: "Question Bank", group: "Go to", run: () => router.push("/question-bank") }]
        : []),
      { key: "nav-settings", label: "Settings", group: "Go to", run: () => router.push("/settings") },
    ];
    const cand: Command[] = candidates.map((c) => ({
      key: `candidate-${c.id}`,
      label: c.name,
      group: "Candidates",
      run: () => router.push(`/candidates/${c.id}`),
    }));
    const themes: Command[] = THEMES.map((t) => ({
      key: `theme-${t.id}`,
      label: `Theme: ${t.name}`,
      group: "Theme",
      run: () => setTheme(t.id),
    }));
    return [...nav, ...cand, ...themes];
  }, [candidates, canEditBank, router, setTheme]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q))
      : commands;
    // Cap so a huge candidate list doesn't render thousands of rows.
    return matched.slice(0, 50);
  }, [commands, query]);

  // Group in first-seen order for rendering, but keep a flat index for the keys.
  const groups = useMemo(() => {
    const map = new Map<string, { cmd: Command; index: number }[]>();
    results.forEach((cmd, index) => {
      const list = map.get(cmd.group) ?? [];
      list.push({ cmd, index });
      map.set(cmd.group, list);
    });
    return [...map.entries()];
  }, [results]);

  function activate(cmd: Command) {
    cmd.run();
    setOpen(false);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length); // wraps
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[active];
      if (cmd) activate(cmd);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="command-palette"
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <input
          ref={inputRef}
          data-testid="command-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Jump to a candidate, page or theme…"
          aria-label="Command palette search"
          aria-activedescendant={
            results[active] ? `command-item-${results[active].key}` : undefined
          }
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-1" role="listbox">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results.
            </p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                {items.map(({ cmd, index }) => (
                  <button
                    key={cmd.key}
                    id={`command-item-${cmd.key}`}
                    data-testid={`command-item-${cmd.key}`}
                    data-active={index === active ? "true" : undefined}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => activate(cmd)}
                    className={cn(
                      "flex w-full items-center rounded-md px-3 py-2 text-left text-sm",
                      index === active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground"
                    )}
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
