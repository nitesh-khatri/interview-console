"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, X, Save } from "lucide-react";
import type { Role, User } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserManagement } from "@/components/settings/user-management";
import { cn } from "@/lib/utils";

export function SettingsView({
  role,
  currentUserId,
  ratingParams,
  roundPresets,
  users,
}: {
  role: Role;
  currentUserId: number;
  ratingParams: string[];
  roundPresets: string[];
  users: User[];
}) {
  const { theme, setTheme } = useTheme();
  const isAdmin = role === "admin";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Appearance</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick a theme. This is saved on this device.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  theme === t.id
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-foreground/30"
                )}
              >
                <span className="flex overflow-hidden rounded-md border">
                  {t.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="h-8 w-3"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {t.mode}
                  </span>
                </span>
                {theme === t.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="mt-4 flex items-center gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await api("/api/settings", {
                      method: "PUT",
                      body: JSON.stringify({ default_theme: theme }),
                    });
                    toast.success("Default theme set for new users");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                Set current theme as org default
              </Button>
              <span className="text-xs text-muted-foreground">
                Applied to users who haven&apos;t chosen their own.
              </span>
            </div>
          )}
        </section>

        {isAdmin && (
          <>
            <ListEditor
              title="Scoring parameters"
              description="Default quick-look scoring parameters seeded into every new interview round."
              settingKey="rating_params"
              initial={ratingParams}
              placeholder="e.g. Culture fit"
            />
            <ListEditor
              title="Round presets"
              description="Round titles offered when assigning a candidate to a new round."
              settingKey="round_presets"
              initial={roundPresets}
              placeholder="e.g. System Design Round"
            />
            <UserManagement users={users} currentUserId={currentUserId} />
          </>
        )}

        {!isAdmin && (
          <section className="rounded-xl border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
            Interview configuration and user management are managed by admins.
          </section>
        )}
      </div>
    </div>
  );
}

function ListEditor({
  title,
  description,
  settingKey,
  initial,
  placeholder,
}: {
  title: string;
  description: string;
  settingKey: "rating_params" | "round_presets";
  initial: string[];
  placeholder: string;
}) {
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Compare against what's actually persisted, not the `initial` prop — that
  // prop doesn't change after a save, so the Save button would never clear.
  const [saved, setSaved] = useState<string[]>(initial);
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      toast.error("That item already exists");
      return;
    }
    setItems([...items, v]);
    setDraft("");
  }

  async function save() {
    if (items.length === 0) {
      toast.error("Keep at least one item");
      return;
    }
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ [settingKey]: items }),
      });
      setSaved(items);
      toast.success(`${title} saved`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1.5 text-sm"
          >
            {item}
            <button
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex max-w-sm items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" size="icon" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
