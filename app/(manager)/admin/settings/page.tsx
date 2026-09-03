import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const rate = (await getSetting("labour_rate_per_hour")) ?? "0";

  return (
    <>
      <Link className="link-back" href="/dashboard">
        ← Dashboard
      </Link>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <div className="card">
        <SettingsForm rate={rate} />
      </div>
    </>
  );
}
