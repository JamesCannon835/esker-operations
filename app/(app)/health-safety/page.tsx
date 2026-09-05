import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { HsFolderView } from "./folder-view";

export const dynamic = "force-dynamic";

export default async function HealthSafetyPage() {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return <HsFolderView folderId={null} />;
}
