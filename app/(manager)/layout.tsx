import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isManager, type Role } from "@/lib/roles";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleRows ?? []).map((r) => r.role as Role);

  // Master-data screens are Transport Manager / Admin only (architecture Sec.6).
  // Row Level Security is the real backstop; this is the UI guard.
  if (!isManager(roles)) redirect("/dashboard");

  return (
    <>
      <AppHeader isManager />
      <div className="container">{children}</div>
    </>
  );
}
