import { AppNav } from "./app-nav";
import type { Role } from "@/lib/roles";

export function AppHeader({ roles }: { roles: Role[] }) {
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <strong>Esker Operations</strong>
          <form action="/auth/signout" method="post">
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <AppNav roles={roles} />
    </>
  );
}
