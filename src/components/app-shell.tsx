"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck,
  LayoutDashboard,
  Users,
  Library,
  Settings,
  LogOut,
  KeyRound,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import {
  canEditQuestionBank,
  userLabel,
  type SessionUser,
} from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenu } from "@/components/theme-menu";
import { ChangePasswordDialog } from "@/components/change-password-dialog";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(user.must_change_password === 1);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/candidates", label: "Candidates", icon: Users },
    ...(canEditQuestionBank(user.role)
      ? [{ href: "/question-bank", label: "Question Bank", icon: Library }]
      : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/login");
    router.refresh();
  }

  const initials = user.display_name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Interview Console</span> 
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span> 
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeMenu />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium">{user.display_name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {userLabel(user.role, user.department)}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="font-medium">{user.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      @{user.username} · {userLabel(user.role, user.department)}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPwOpen(true)}>
                  <KeyRound className="h-4 w-4" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={logout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {user.must_change_password === 1 && (
        <div className="border-b bg-warning/15 px-4 py-2 text-sm text-foreground">
          <button
            className="font-medium underline underline-offset-2"
            onClick={() => setPwOpen(true)}
          >
            Please set a new password
          </button>{" "}
          to secure your account.
        </div>
      )}

      <main className="flex-1">{children}</main>

      <ChangePasswordDialog
        open={pwOpen}
        onOpenChange={setPwOpen}
        forced={user.must_change_password === 1}
        onDone={() => {
          toast.success("Password updated");
          router.refresh();
        }}
      />
    </div>
  );
}
