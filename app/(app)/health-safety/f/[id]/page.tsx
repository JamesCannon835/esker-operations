import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { HsFolderView } from "../../folder-view";

export const dynamic = "force-dynamic";

export default async function HealthSafetyFolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  const { id } = await params;
  return <HsFolderView folderId={id} />;
}
