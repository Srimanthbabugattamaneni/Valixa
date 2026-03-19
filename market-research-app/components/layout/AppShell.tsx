import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";

// ── Icons ──────────────────────────────────────────────────────────────────────
function IconPulse() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Nav config ─────────────────────────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { label: "Dashboard",           href: "/dashboard",       icon: <IconGrid />,    match: ["/dashboard"] },
  { label: "Market Reports",      href: ROUTES.analyze,     icon: <IconDoc />,     match: ["/analyze", "/reports"] },
  { label: "Compare Locations",   href: ROUTES.compare,     icon: <IconTrend />,   match: ["/compare"] },
  { label: "Marketplace",         href: ROUTES.marketplace, icon: <IconStore />,   match: ["/marketplace"] },
  { label: "Find Partners",       href: ROUTES.partners,    icon: <IconUsers />,   match: ["/partners"] },
];

// ── Component ──────────────────────────────────────────────────────────────────
interface AppShellProps {
  children: ReactNode;
  /** Optional page title shown in the top bar instead of search */
  headerSlot?: ReactNode;
}

export default function AppShell({ children, headerSlot }: AppShellProps) {
  const { pathname } = useRouter();
  const { data: session } = useSession();

  const userName = (session?.user as { name?: string })?.name ?? session?.user?.email ?? "User";

  function isActive(match: readonly string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + "/"));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">

      {/* ── Sidebar ── */}
      <aside className="w-56 flex flex-col shrink-0 border-r border-white/[0.06] bg-[#09090b]">
        <Link href="/dashboard" className="px-5 py-5 flex items-center gap-2.5 border-b border-white/[0.06]">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center text-white">
            <IconPulse />
          </div>
          <span className="text-white font-bold">{siteConfig.name}</span>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive(item.match)
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/20 font-medium"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">PRO PLAN</p>
            <p className="text-xs text-gray-600 mb-3">AI-powered forecasting unlocked</p>
            <button className="w-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-bold py-2 rounded-lg transition hover:opacity-90 uppercase tracking-wide">
              Manage Subscription
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl flex items-center px-6 gap-4 shrink-0">
          {headerSlot ?? (
            <div className="flex-1 max-w-lg relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-600 pointer-events-none">
                <IconSearch />
              </span>
              <Link href={ROUTES.analyze}>
                <input
                  type="text"
                  readOnly
                  placeholder="Describe your business idea…"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl cursor-pointer hover:border-violet-500/40 focus:outline-none placeholder-gray-600 text-gray-300"
                />
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] rounded-lg transition">
              <IconBell />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-200 leading-none">{userName}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Founder Pro</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#09090b]">
          {children}
        </main>
      </div>
    </div>
  );
}
