"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  FolderKanban,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { logOut } from "@/components/account-panel";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown greyed out with a "Soon" tag until the page exists. */
  comingSoon?: boolean;
  /** Only listed for the master account (the page itself also checks). */
  masterOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "History", href: "/history", icon: History },
  { label: "Projects", href: "/projects", icon: FolderKanban, masterOnly: true },
  { label: "Tower Selector", href: "/selector", icon: Calculator, masterOnly: true },
  { label: "Account", href: "/account", icon: UserRound },
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

/** Who designed and built the app. */
function Credit({ className }: { className?: string }) {
  return <p className={cn("text-center text-[10px]", className)}>{new Date().getFullYear()} © andremelos92-dev</p>;
}

function NavLinks({ onNavigate, master }: { onNavigate?: () => void; master: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1 px-3">
      {NAV_ITEMS.filter((item) => master || !item.masterOnly).map(({ label, href, icon: Icon, comingSoon }) => {
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

function LogOutButton() {
  return (
    <button
      type="button"
      onClick={() => void logOut()}
      className="flex w-full items-center gap-3 rounded-md py-2.5 pr-3 pl-4 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
    >
      <LogOut className="size-4 text-sky-400" />
      Log out
    </button>
  );
}

/** Dark sidebar navigation on desktop; a top bar with a slide-out menu on small screens. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [master, setMaster] = useState(false);
  const pathname = usePathname();
  const signedIn = pathname !== "/";

  // Master-only links appear once the signed-in account is known.
  useEffect(() => {
    if (!signedIn) return;
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => setMaster(Boolean(me?.master)))
      .catch(() => setMaster(false));
  }, [signedIn]);

  // The front (login) page has its own header and no navigation.
  if (pathname === "/") return <>{children}</>;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-[#1f2226] md:flex">
        <div className="flex h-24 flex-col items-center justify-center gap-2 border-b border-white/10 px-3">
          <Logo />
          <p className="text-center text-[11px] leading-tight text-white/70">Truwater Technologies Australia Pty Ltd</p>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks master={master} />
        </div>
        <div className="border-t border-white/10 p-3">
          <LogOutButton />
          <Credit className="mt-3 text-white/40" />
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
            <NavLinks master={master} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-2 border-t border-white/10 px-3 pt-2">
              <LogOutButton />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0">
        {children}
        <Credit className="text-muted-foreground pb-6 md:hidden" />
      </div>
    </div>
  );
}
