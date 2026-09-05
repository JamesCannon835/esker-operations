import Link from "next/link";

type Area = {
  href: string;
  label: string;
  sub: string;
  emoji: string;
  color: string;
};

// Muted, brand-adjacent palette — no red (reserved for nothing; alarm is
// black/yellow). Each area gets its own colour so the hub reads at a glance.
const AREAS: Area[] = [
  { href: "/vehicles", label: "Vehicles", sub: "Fleet, plant & trailers", emoji: "🚛", color: "#ed7b00" },
  { href: "/compliance", label: "Compliance", sub: "Tax, CVRT, tacho", emoji: "📋", color: "#8a6d1f" },
  { href: "/faults", label: "Workshop", sub: "Faults & jobs", emoji: "🔧", color: "#3f3a34" },
  { href: "/vehicle-inspections", label: "Inspections", sub: "13-week / CVRT", emoji: "✅", color: "#0f766e" },
  { href: "/maintenance", label: "Maintenance", sub: "Reports & history", emoji: "🛠️", color: "#3f5a8a" },
  { href: "/actions", label: "Actions", sub: "Follow-ups", emoji: "🎯", color: "#6b4a7a" },
  { href: "/training", label: "Training", sub: "Courses & certs", emoji: "🎓", color: "#5b6e2f" },
  { href: "/library/health-safety", label: "Documents", sub: "H&S · Quality · Environmental", emoji: "📁", color: "#4a6b7a" },
  { href: "/toolbox", label: "Toolbox Talks", sub: "Send & sign", emoji: "🦺", color: "#1f5a5a" },
  { href: "/deliveries", label: "Deliveries In", sub: "Cement, sand, stone", emoji: "🧾", color: "#7a5c3a" },
  { href: "/blasting", label: "Blasting", sub: "Notify neighbours", emoji: "💥", color: "#7a4a2f" },
  { href: "/leave", label: "Time Off", sub: "Book & approve", emoji: "🌴", color: "#2f6e4a" },
  { href: "/reports", label: "Reports", sub: "Export data", emoji: "📊", color: "#8a6a3a" },
];

const ADMIN_AREA: Area = {
  href: "/admin/users",
  label: "Admin",
  sub: "Users & settings",
  emoji: "⚙️",
  color: "#1b1a18",
};

export function AreaHub({ isAdmin }: { isAdmin: boolean }) {
  const areas = isAdmin ? [...AREAS, ADMIN_AREA] : AREAS;
  return (
    <div className="card">
      <h2>Areas</h2>
      <div className="hub">
        {areas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="hub-tile"
            style={{ "--hub": a.color } as React.CSSProperties}
          >
            <span className="hub-emoji">{a.emoji}</span>
            <span>
              <span className="hub-label">{a.label}</span>
              <span className="hub-sub" style={{ display: "block" }}>
                {a.sub}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
