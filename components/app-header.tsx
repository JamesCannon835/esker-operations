import { AppNav } from "./app-nav";

export function AppHeader({ isManager }: { isManager: boolean }) {
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
      <AppNav isManager={isManager} />
    </>
  );
}
