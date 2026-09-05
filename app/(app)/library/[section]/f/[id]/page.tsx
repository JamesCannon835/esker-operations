import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { sectionFromSlug } from "@/lib/doc-library";
import { FolderView } from "../../../folder-view";

export const dynamic = "force-dynamic";

export default async function LibraryFolderPage({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  const { section: slug, id } = await params;
  const section = sectionFromSlug(slug);
  if (!section) notFound();
  return <FolderView section={section} folderId={id} />;
}
