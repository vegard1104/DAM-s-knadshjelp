"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderClosed,
  BarChart3,
  Settings,
  Plus,
} from "lucide-react";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Hjem", icon: Home },
  { href: "/soknader", label: "Søknader", icon: FolderClosed },
  { href: "/statistikk", label: "Statistikk", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
];

export function Sidebar({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin" || user.role === "utvikler";

  return (
    <aside className="hidden lg:flex flex-col w-[240px] border-r border-line-1 bg-bg-card shrink-0">
      {/* Logo / appnavn */}
      <div className="px-5 pt-6 pb-5 border-b border-line-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-cp-blue-dark text-white grid place-items-center text-[13px] font-bold tracking-tight">
            CP
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold text-ink-1">
              Søknadshjelpe
            </div>
            <div className="text-[11px] text-ink-4">DAM · CP-foreningen</div>
          </div>
        </div>
      </div>

      {/* Ny søknad-knapp */}
      <div className="px-3 pt-4">
        <Link
          href="/soknader/ny"
          className="flex items-center gap-2 rounded-md bg-cp-blue px-3 py-2 text-[13px] font-medium text-white transition hover:bg-cp-blue-dark shadow-cp-sm"
        >
          <Plus className="h-4 w-4" /> Ny søknad
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-4 flex-1">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition mb-0.5",
                active
                  ? "bg-cp-blue-soft text-cp-blue-dark"
                  : "text-ink-3 hover:bg-line-3 hover:text-ink-1",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bruker nederst */}
      <div className="px-3 py-4 border-t border-line-2">
        <Link
          href="/profil"
          className="flex items-center gap-2.5 rounded-md p-2 hover:bg-line-3"
        >
          <Avatar initials={nameToInitials(user.name)} size="md" />
          <div className="leading-tight min-w-0">
            <div className="text-[12.5px] font-medium text-ink-1 truncate">
              {user.name}
            </div>
            <div className="text-[11px] text-ink-4 truncate">{user.email}</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
