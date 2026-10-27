"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, ScanLine, Users, Calendar, BarChart2, ClipboardList, LogOut, Menu, X, ShieldAlert, Home } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "@/components/Brand";

const LINKS = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/scanner", icon: ScanLine, label: "Scanner" },
  { href: "/admin/participants", icon: Users, label: "Attendance" },
  { href: "/admin/events", icon: Calendar, label: "Events" },
  { href: "/admin/reports", icon: BarChart2, label: "Reports" },
  { href: "/admin/audit", icon: ClipboardList, label: "Audit Log" },
  { href: "/admin/integrity", icon: ShieldAlert, label: "Integrity" },
];

interface Props {
  displayName: string | null;
  email: string | null;
  role: string;
  children: React.ReactNode;
}

export default function AdminShell({ displayName, email, role, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer on navigation and with Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const current = LINKS.find((l) => isActive(l.href, l.exact));

  const account = (
    <div className="border-t border-[#dce7e5] p-4">
      <p className="text-sm font-semibold text-ink truncate">{displayName ?? email}</p>
      <p className="text-xs text-[#4b6362] capitalize">{role.replace("_", " ")}</p>
      <button onClick={signOut} disabled={signingOut} className="btn-ghost w-full justify-start gap-2 mt-2 text-[#4b6362]">
        <LogOut className="w-4 h-4" /> {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  const navLinks = (
    <nav className="sidebar flex-1 overflow-y-auto" aria-label="Admin">
      {LINKS.map(({ href, icon: Icon, label, exact }) => (
        <Link
          key={href}
          href={href}
          prefetch={true}
          onClick={() => setDrawerOpen(false)}
          aria-current={isActive(href, exact) ? "page" : undefined}
          className={clsx("sidebar-link min-h-11", isActive(href, exact) && "active")}
        >
          <Icon className="w-[18px] h-[18px] shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );

  const tabs = [
    { href: "/admin", icon: Home, label: "Home", exact: true },
    { href: "/admin/events", icon: Calendar, label: "Events" },
  ];
  const tabsRight = [
    { href: "/admin/participants", icon: Users, label: "Attendance" },
    { href: "/admin/reports", icon: BarChart2, label: "Reports" },
  ];

  return (
    <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden bg-[#f3f7f6]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#dce7e5] bg-white shrink-0">
        <div className="flex items-center px-5 h-16 border-b border-[#dce7e5]">
          <Logo size="sm" />
        </div>
        {navLinks}
        {account}
      </aside>

      {/* Mobile "More" drawer */}
      <div
        className={clsx("fixed inset-0 z-40 bg-ink/60 transition-opacity lg:hidden", drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        aria-label="Menu"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] bg-white rounded-t-[28px] flex flex-col transition-transform duration-300 lg:hidden pb-[env(safe-area-inset-bottom)]",
          drawerOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <Logo size="sm" />
          <button onClick={() => setDrawerOpen(false)} className="btn-ghost w-11 h-11 p-0" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        {navLinks}
        {account}
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 lg:overflow-hidden">
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between gap-3 pl-4 pr-2 h-14 pt-[env(safe-area-inset-top)] box-content bg-ink text-white">
          <Logo size="sm" tone="dark" />
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-sm font-semibold text-[#a7c9c6] truncate">{current?.label}</span>
            <button type="button" onClick={() => setDrawerOpen(true)} className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-white/10" aria-expanded={drawerOpen} aria-label="Open menu">
              <Menu className="w-[22px] h-[22px]" />
            </button>
          </div>
        </header>
        {/* min-h-0 lets this flex child scroll instead of growing past the viewport (desktop);
            bottom padding keeps content clear of the fixed tab bar (mobile/tablet). */}
        <main className="flex-1 min-h-0 lg:overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6 sm:pt-6 lg:p-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="tabbar lg:hidden" aria-label="Quick navigation">
        {tabs.map(({ href, icon: Icon, label, exact }) => (
          <Link key={href} href={href} prefetch={true} className={clsx("tab-link", isActive(href, exact) && "active")} aria-current={isActive(href, exact) ? "page" : undefined}>
            <Icon className="w-[22px] h-[22px]" />
            {label}
          </Link>
        ))}
        <Link href="/admin/scanner" prefetch={true} className={clsx("tab-link", isActive("/admin/scanner") && "active")} aria-current={isActive("/admin/scanner") ? "page" : undefined}>
          <span className="tab-scan"><ScanLine className="w-[26px] h-[26px]" /></span>
          Scan
        </Link>
        {tabsRight.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} prefetch={true} className={clsx("tab-link", isActive(href) && "active")} aria-current={isActive(href) ? "page" : undefined}>
            <Icon className="w-[22px] h-[22px]" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
