"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isManager, type Role } from "@/lib/roles";

type NavLink = { href: string; label: string };

const DASHBOARD: NavLink = { href: "/dashboard", label: "Dashboard" };

const MANAGER_LINKS: NavLink[] = [
  DASHBOARD,
  { href: "/vehicles", label: "Vehicles" },
  { href: "/plant", label: "Plant" },
  { href: "/trailers", label: "Trailers" },
  { href: "/compliance", label: "Compliance" },
  { href: "/faults", label: "Faults" },
  { href: "/reports", label: "Reports" },
];

const FIELD_LINKS: NavLink[] = [
  DASHBOARD,
  { href: "/check", label: "Daily Check" },
  { href: "/inspections", label: "Inspections" },
  { href: "/faults", label: "Faults" },
  { href: "/breakdowns", label: "Breakdowns" },
  { href: "/services", label: "Services" },
];

export function AppNav({ roles }: { roles: Role[] }) {
  const pathname = usePathname();
  const links = [...(isManager(roles) ? MANAGER_LINKS : FIELD_LINKS)];
  if (roles.includes("admin")) {
    links.push({ href: "/admin/users", label: "Users" });
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        {links.map((link) => {
          const active =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "active" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
