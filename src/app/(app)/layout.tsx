import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCandidates } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // A light list for the ⌘K command palette (ticket #22).
  const candidates = listCandidates().map((c) => ({ id: c.id, name: c.name }));

  return (
    <AppShell
      user={{
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        department: user.department,
        must_change_password: user.must_change_password,
      }}
      candidates={candidates}
    >
      {children}
    </AppShell>
  );
}
