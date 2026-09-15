"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, KeyRound, Loader2 } from "lucide-react";
import type { User } from "@/lib/types";
import {
  USER_TYPES,
  accessOf,
  toRoleAndDept,
  type Access,
  type UserType,
} from "@/lib/session";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The user's Type (department), deriving a sensible value for legacy rows. */
function typeOf(u: User): UserType {
  if (
    u.department === "Human Resources" ||
    u.department === "Developer" ||
    u.department === "Product"
  ) {
    return u.department;
  }
  return u.role === "hr" ? "Human Resources" : "Developer";
}

export function UserManagement({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);

  async function patchUser(id: number, body: Record<string, unknown>) {
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Admins manage the app; everyone else is a User with a type.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>
      <Table>
        <TableHeader className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <TableHead className="py-2 pr-4 font-medium">Name</TableHead>
            <TableHead className="py-2 pr-4 font-medium">Access</TableHead>
            <TableHead className="py-2 pr-4 font-medium">Type</TableHead>
            <TableHead className="py-2 pr-4 font-medium">Active</TableHead>
            <TableHead className="py-2 font-medium text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const access = accessOf(u.role);
            const type = typeOf(u);
            return (
              <TableRow key={u.id}>
                <TableCell className="py-2.5 pr-4">
                  <div className="font-medium">{u.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{u.username}
                  </div>
                </TableCell>
                <TableCell className="py-2.5 pr-4">
                  <Select
                    value={access}
                    onValueChange={(v) => {
                      const { role, department } = toRoleAndDept(
                        v as Access,
                        type,
                      );
                      patchUser(u.id, { role, department });
                    }}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2.5 pr-4">
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      const { role, department } = toRoleAndDept(
                        access,
                        v as UserType,
                      );
                      patchUser(u.id, { role, department });
                    }}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2.5 pr-4">
                  <Switch
                    checked={u.active === 1}
                    disabled={isSelf}
                    onCheckedChange={(c) => patchUser(u.id, { active: c })}
                  />
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetUser(u)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset password
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
      <ResetPasswordDialog
        user={resetUser}
        onClose={() => setResetUser(null)}
      />
    </section>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [access, setAccess] = useState<Access>("user");
  const [type, setType] = useState<UserType>("Developer");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { role, department } = toRoleAndDept(access, type);
    setLoading(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: String(fd.get("username") || "").trim(),
          display_name: String(fd.get("display_name") || "").trim(),
          password: String(fd.get("password") || ""),
          role,
          department,
        }),
      });
      toast.success("User created — they'll set a new password on first login");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" name="display_name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-username">Username</Label>
            <Input id="u-username" name="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-password">Temporary password</Label>
            <Input
              id="u-password"
              name="password"
              type="text"
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              The user is prompted to change this on first sign-in.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select
                value={access}
                onValueChange={(v) => setAccess(v as Access)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as UserType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          new_password: String(fd.get("new_password") || ""),
        }),
      });
      toast.success(`Password reset for ${user.display_name}`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a new temporary password for{" "}
            <span className="font-medium text-foreground">
              {user?.display_name}
            </span>
            . They&apos;ll be asked to change it at next sign-in, and current
            sessions are signed out.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="r-password">New password</Label>
            <Input
              id="r-password"
              name="new_password"
              type="text"
              minLength={6}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
