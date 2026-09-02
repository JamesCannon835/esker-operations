"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MANAGER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/plant", label: "Plant" },
  { href: "/trailers", label: "Trailers" },
];

const BASIC_LINKS = [{ href: "/dashboard", label: "Dashboard" }];

export function AppNav({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const links = isManager ? MANAGER_LINKS : BASIC_LINKS;

  if (links.length < 2) return null;

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
