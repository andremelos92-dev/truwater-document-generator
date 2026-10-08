"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  History,
  LayoutDashboard,
  Menu,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown greyed out with a "Soon" tag until the page exists. */
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "History", href: "/history", icon: History },
  { label: "Account", href: "/account", icon: UserRound, comingSoon: true },
];

function Logo() {
  return (
    <Image
      src="/truwater-logo.png"
      alt="Truwater"
      width={506}
      height={113}
      priority
      className="h-8 w-auto"
    />
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1 px-3">
      {NAV_ITEMS.map(({ label, href, icon: Icon, comingSoon }) => {
        const active = pathname === href;
        const content = (
          <>
            <span
              className={cn(
                "absolute inset-y-1 left-0 w-1 rounded-r-full",
                active ? "bg-emerald-500" : "bg-transparent"
              )}
            />
            <Icon className={cn("size-4", active ? "text-white" : "text-sky-400")} />
            <span className="flex-1">{label}</span>
            {active && <span className="size-1.5 rounded-full bg-emerald-400" />}
            {comingSoon && (
              <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                Soon
              </span>
            )}
          </>
        );
        const className = cn(
          "relative flex items-center gap-3 rounded-md py-2.5 pr-3 pl-4 text-sm font-medium transition-colors",
          active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
        );

        return comingSoon ? (
          <span key={href} aria-disabled className={cn(className, "cursor-not-allowed opacity-60")}>
            {content}
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={className}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

/** Dark sidebar navigation on desktop; a top bar with a slide-out menu on small screens. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // The front (login) page has its own header and no navigation.
  if (pathname === "/") return <>{children}</>;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-[#1f2226] md:flex">
        <div className="flex h-20 items-center justify-center border-b border-white/10">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#1f2226] px-4 md:hidden">
        <Logo />
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-20 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative bg-[#1f2226] py-3 shadow-lg">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">{children}</div>
    </div>
  );
}
