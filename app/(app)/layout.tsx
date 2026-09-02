import { requireUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles } = await requireUser();

  return (
    <>
      <AppHeader roles={roles} />
      <div className="container">{children}</div>
    </>
  );
}
