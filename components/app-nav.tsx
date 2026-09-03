"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isManager, hasRole, type Role } from "@/lib/roles";

type NavLink = { href: string; label: string };

const DASHBOARD: NavLink = { href: "/dashboard", label: "Dashboard" };

const MANAGER_LINKS: NavLink[] = [
  DASHBOARD,
  { href: "/vehicles", label: "Vehicles" },
  { href: "/plant", label: "Plant" },
  { href: "/trailers", label: "Trailers" },
  { href: "/compliance", label: "Compliance" },
  { href: "/faults", label: "Faults" },
  { href: "/training", label: "Training" },
  { href: "/reports", label: "Reports" },
];

const MECHANIC_LINKS: NavLink[] = [
  DASHBOARD,
  { href: "/vehicles", label: "Vehicles" },
  { href: "/plant", label: "Plant" },
  { href: "/trailers", label: "Trailers" },
  { href: "/faults", label: "Faults" },
  { href: "/inspections", label: "Inspections" },
  { href: "/compliance", label: "Compliance" },
];

// Drivers and plant operators — kept deliberately minimal.
const BASIC_LINKS: NavLink[] = [
  DASHBOARD,
  { href: "/check", label: "Daily Check" },
  { href: "/faults", label: "My Faults" },
];

export function AppNav({ roles }: { roles: Role[] }) {
  const pathname = usePathname();

  const links = isManager(roles)
    ? [...MANAGER_LINKS]
    : hasRole(roles, "mechanic")
      ? [...MECHANIC_LINKS]
      : [...BASIC_LINKS];

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
