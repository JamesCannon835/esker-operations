"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isManager, hasRole, type Role } from "@/lib/roles";

type NavLink = { href: string; label: string; alsoActive?: string[] };
type NavGroup = { label: string; links: NavLink[] };
type NavEntry = NavLink | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "links" in e;
}

const DASHBOARD: NavLink = { href: "/dashboard", label: "Dashboard" };

const FLEET: NavLink = {
  href: "/vehicles",
  label: "Vehicles",
  alsoActive: ["/plant", "/trailers"],
};

const WORKSHOP: NavGroup = {
  label: "Workshop",
  links: [
    { href: "/faults", label: "Faults" },
    { href: "/vehicle-inspections", label: "Inspections" },
    { href: "/maintenance", label: "Maintenance" },
    { href: "/actions", label: "Tasks" },
  ],
};

const LIBRARY: NavGroup = {
  label: "Documents",
  links: [
    { href: "/library/health-safety", label: "Health & Safety" },
    { href: "/library/quality", label: "Quality" },
    { href: "/library/environmental", label: "Environmental" },
  ],
};

const TIME_OFF: NavLink = { href: "/leave", label: "Time Off" };
const TOOLBOX: NavLink = { href: "/toolbox", label: "Toolbox Talks" };
const VERTI_BLOCK: NavLink = { href: "/verti-block", label: "Verti-Block" };
const PRECAST: NavLink = { href: "/precast", label: "Precast" };

const SAFETY: NavGroup = {
  label: "Safety",
  links: [
    { href: "/training", label: "Training" },
    TOOLBOX,
  ],
};

const PRODUCTS: NavGroup = {
  label: "Products",
  links: [VERTI_BLOCK, PRECAST],
};

const MANAGER_LINKS: NavEntry[] = [
  DASHBOARD,
  FLEET,
  { href: "/compliance", label: "Compliance" },
  WORKSHOP,
  SAFETY,
  LIBRARY,
  { href: "/deliveries", label: "Goods In" },
  { href: "/blasting", label: "Blasting" },
  PRODUCTS,
  TIME_OFF,
  { href: "/reports", label: "Reports" },
];

const MECHANIC_LINKS: NavEntry[] = [
  DASHBOARD,
  FLEET,
  WORKSHOP,
  { href: "/compliance", label: "Compliance" },
  LIBRARY,
  TOOLBOX,
  TIME_OFF,
];

// Drivers and plant operators — kept deliberately minimal.
const BASIC_LINKS: NavEntry[] = [
  DASHBOARD,
  { href: "/check", label: "Daily Check" },
  { href: "/faults", label: "My Faults" },
  TOOLBOX,
  TIME_OFF,
];

const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  links: [
    { href: "/admin/users", label: "Users" },
    { href: "/admin/settings", label: "Settings" },
  ],
};

export function AppNav({ roles }: { roles: Role[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(null), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const links: NavEntry[] = isManager(roles)
    ? [...MANAGER_LINKS]
    : hasRole(roles, "mechanic")
      ? [...MECHANIC_LINKS]
      : [...BASIC_LINKS];

  // Plant / yard / quarry staff also get the Verti-Block sheet + their Tasks.
  if (
    !isManager(roles) &&
    !hasRole(roles, "mechanic") &&
    (hasRole(roles, "plant_operator") || hasRole(roles, "yard_staff"))
  ) {
    links.splice(1, 0, VERTI_BLOCK, PRECAST, {
      href: "/actions",
      label: "My Tasks",
    });
  }

  if (roles.includes("admin")) {
    links.push(ADMIN_GROUP);
  }

  const isActive = (href: string, alsoActive?: string[]) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href) ||
        (alsoActive?.some((p) => pathname.startsWith(p)) ?? false);

  return (
    <nav className="nav">
      <div className="nav-inner" ref={navRef}>
        {links.map((entry) => {
          if (isGroup(entry)) {
            const active = entry.links.some((l) => isActive(l.href));
            const isOpen = open === entry.label;
            return (
              <div className="nav-group" key={entry.label}>
                <button
                  type="button"
                  className={active ? "active" : undefined}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : entry.label)}
                >
                  {entry.label}
                  <span className="nav-caret">▾</span>
                </button>
                {isOpen && (
                  <div className="nav-dropdown">
                    {entry.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={isActive(l.href) ? "active" : undefined}
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={
                isActive(entry.href, entry.alsoActive) ? "active" : undefined
              }
            >
              {entry.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
