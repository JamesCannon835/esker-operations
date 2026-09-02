export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button className="btn secondary" type="submit">
        Sign out
      </button>
    </form>
  );
}
