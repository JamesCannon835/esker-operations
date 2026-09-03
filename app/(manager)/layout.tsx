import { requireStaff } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

// Assets, compliance, checklists, reports. Managers + admin have full run of
// this group; mechanics reach the asset screens (checklists/reports pages
// re-check for manager themselves).
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles } = await requireStaff();

  return (
    <>
      <AppHeader roles={roles} />
      <div className="container">{children}</div>
    </>
  );
}
