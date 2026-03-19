"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { ROUTES } from "@/config/routes";

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconAnalyze() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function IconCompare() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
}
function IconDashboard() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function IconReports() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
}
function IconMarket() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}
function IconPartners() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
}
function IconMessages() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
}
function IconSignOut() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
function IconMenu() {
  return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
}
function IconClose() {
  return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────
const PUBLIC_NAV = [
  { label: "Features",     href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Marketplace",  href: ROUTES.marketplace },
  { label: "Partners",     href: ROUTES.partners },
];

const AUTH_NAV = [
  { label: "Analyze",     href: ROUTES.analyze,      icon: <IconAnalyze /> },
  { label: "Compare",     href: ROUTES.compare,      icon: <IconCompare /> },
  { label: "Marketplace", href: ROUTES.marketplace,  icon: <IconMarket /> },
  { label: "Partners",    href: ROUTES.partners,     icon: <IconPartners /> },
];

const USER_MENU = [
  { label: "Dashboard",  href: ROUTES.dashboard,  icon: <IconDashboard /> },
  { label: "My Reports", href: ROUTES.reports,    icon: <IconReports /> },
  { label: "Messages",   href: ROUTES.messages,   icon: <IconMessages /> },
];

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <Link href={ROUTES.home} className="flex items-center gap-2 shrink-0 group">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center group-hover:from-violet-400 group-hover:to-blue-400 transition-all">
        <svg className="w-[15px] h-[15px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <span className="font-bold text-gray-100 text-[16px] tracking-tight leading-none">
        Valixa
      </span>
    </Link>
  );
}

// ── Pill nav item ─────────────────────────────────────────────────────────────
function PillNavItem({ label, href, icon }: { label: string; href: string; icon?: React.ReactNode }) {
  const { pathname } = useRouter();
  const isHash   = href.includes("#");
  const Tag      = isHash ? "a" : Link;
  const active   = !isHash && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <Tag
      href={href}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-white shadow-sm border border-white/10"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
      }`}
    >
      {icon && <span className={active ? "text-violet-300" : "text-gray-500"}>{icon}</span>}
      {label}
    </Tag>
  );
}

// ── Avatar dropdown ───────────────────────────────────────────────────────────
function UserDropdown({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/10 hover:border-violet-400/40 hover:bg-white/[0.06] transition-all"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          {initials}
        </div>
        <span className="text-sm font-medium text-gray-300 hidden sm:block max-w-[90px] truncate pr-0.5">
          {name.split(" ")[0]}
        </span>
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-2xl shadow-xl shadow-black/40 py-2 z-50">
          <div className="px-4 py-2.5 border-b border-white/[0.06] mb-1">
            <p className="text-xs font-semibold text-gray-200 truncate">{name}</p>
            <p className="text-[11px] text-gray-500 truncate">{email}</p>
          </div>
          {USER_MENU.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-violet-300 transition-colors"
            >
              <span className="text-gray-500">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="border-t border-white/[0.06] mt-1 pt-1">
            <button
              onClick={() => signOut({ callbackUrl: ROUTES.home })}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <IconSignOut />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile menu ───────────────────────────────────────────────────────────────
function MobileMenu({
  open,
  session,
  onClose,
}: {
  open: boolean;
  session: ReturnType<typeof useSession>["data"];
  onClose: () => void;
}) {
  if (!open) return null;
  const nav = session ? AUTH_NAV : PUBLIC_NAV;

  return (
    <div className="lg:hidden border-t border-white/[0.06] glass px-4 py-3 space-y-1 mx-4 rounded-b-2xl">
      {nav.map(item => {
        const isHash = item.href.includes("#");
        const Tag    = isHash ? "a" : Link;
        return (
          <Tag
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.06] hover:text-violet-300 transition-colors"
          >
            {"icon" in item && (item as { icon?: React.ReactNode }).icon && <span className="text-gray-500">{(item as { icon?: React.ReactNode }).icon}</span>}
            {item.label}
          </Tag>
        );
      })}
      <div className="border-t border-white/[0.06] pt-3 mt-2 space-y-1">
        {session ? (
          <>
            {USER_MENU.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.06] transition-colors"
              >
                <span className="text-gray-500">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => { onClose(); signOut({ callbackUrl: ROUTES.home }); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <IconSignOut />
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href={ROUTES.login} onClick={onClose}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.06] transition-colors">
              Sign In
            </Link>
            <Link href={ROUTES.analyze} onClick={onClose}
              className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 transition-all text-center">
              Get Started Free
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const loading = status === "loading";

  const userName  = (session?.user as { name?: string })?.name ?? session?.user?.email ?? "User";
  const userEmail = session?.user?.email ?? "";

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 60) { setVisible(true); lastY.current = y; return; }
      if (y > lastY.current + 6) setVisible(false);
      else if (y < lastY.current - 6) setVisible(true);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 z-50 transition-all duration-300 ease-in-out ${
        visible ? "top-0" : "-top-20"
      }`}
    >
      {/* Floating pill wrapper */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3">
        <div className="flex items-center gap-4 glass rounded-2xl shadow-lg shadow-black/20 px-4 h-13 py-2">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <Logo />

        {/* ── Center: floating pill nav ─────────────────────────────────── */}
        <nav className="hidden lg:flex flex-1 justify-center">
          <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-full px-1.5 py-1">
            {loading ? (
              <div className="w-64 h-7 rounded-full bg-white/[0.06] animate-pulse" />
            ) : session ? (
              <>
                {AUTH_NAV.map(item => (
                  <PillNavItem key={item.href} {...item} />
                ))}
                {/* Divider */}
                <span className="w-px h-4 bg-white/10 mx-1" />
                {/* Sell Business — pill with border */}
                <Link
                  href={ROUTES.newListing}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-white/10 text-sm font-medium text-gray-400 hover:border-violet-400/40 hover:text-violet-300 hover:bg-white/[0.06] transition-all"
                >
                  Sell
                </Link>
              </>
            ) : (
              <>
                {PUBLIC_NAV.map(item => (
                  <PillNavItem key={item.href} label={item.label} href={item.href} />
                ))}
                {/* Divider */}
                <span className="w-px h-4 bg-white/10 mx-1" />
                {/* Sign In */}
                <Link
                  href={ROUTES.login}
                  className="flex items-center px-3.5 py-1.5 rounded-full border border-white/10 text-sm font-medium text-gray-400 hover:border-violet-400/40 hover:text-violet-300 hover:bg-white/[0.06] transition-all"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* ── Right actions ──────────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center ml-auto">
          {loading ? (
            <div className="w-20 h-8 rounded-full bg-white/[0.06] animate-pulse" />
          ) : session ? (
            <UserDropdown name={userName} email={userEmail} />
          ) : (
            <Link
              href={ROUTES.analyze}
              className="text-sm font-semibold bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white px-4 py-2 rounded-full transition-all shadow-lg shadow-violet-500/20"
            >
              Get Started →
            </Link>
          )}
        </div>

        {/* ── Mobile hamburger ──────────────────────────────────────────── */}
        <button
          className="lg:hidden ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-white/[0.06] transition-colors"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
        </div>{/* end floating pill */}
      </div>{/* end max-w wrapper */}

      {/* ── Mobile menu ────────────────────────────────────────────────── */}
      <MobileMenu
        open={mobileOpen}
        session={session}
        onClose={() => setMobileOpen(false)}
      />
    </header>
  );
}
