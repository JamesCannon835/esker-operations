import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "admin")) redirect("/dashboard");
  return <>{children}</>;
}
