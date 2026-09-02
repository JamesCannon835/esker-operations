import { AppNav } from "./app-nav";
import type { Role } from "@/lib/roles";

export function AppHeader({ roles }: { roles: Role[] }) {
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="brand-lockup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/esker-logo.png" alt="Esker Readymix" width={34} height={34} />
            <strong>Esker Operations</strong>
          </span>
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
