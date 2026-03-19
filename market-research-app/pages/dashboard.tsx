import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { ReportSummary } from "@/pages/api/reports";

// ── Onboarding checklist ───────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  { label: "Create your account",       done: true,  href: null },
  { label: "Run your first analysis",   done: false, href: ROUTES.analyze },
  { label: "Complete your partner profile", done: false, href: ROUTES.partnerProfile },
  { label: "Browse the marketplace",    done: false, href: ROUTES.marketplace },
];

function OnboardingChecklist() {
  return (
    <div className="glass rounded-2xl p-5 border border-violet-500/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-blue-500 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-bold text-white">Get started — complete your setup</p>
      </div>
      <div className="space-y-2">
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${step.done ? "opacity-60" : "glass border border-white/[0.08]"}`}>
            <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${step.done ? "bg-violet-500 border-violet-500" : "border-gray-600"}`}>
              {step.done && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-xs flex-1 ${step.done ? "line-through text-gray-500" : "text-gray-300 font-medium"}`}>{step.label}</span>
            {!step.done && step.href && (
              <Link href={step.href} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 hover:underline whitespace-nowrap">
                Do it →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function scoreColor(s: number | null) {
  if (s === null) return "text-gray-500";
  return s >= 70 ? "text-emerald-400" : s >= 45 ? "text-amber-400" : "text-red-400";
}


function statusBadge(status: string, verdict: string | null) {
  if (status === "pending" || status === "processing") {
    return <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 animate-pulse">Processing…</span>;
  }
  if (status === "failed") {
    return <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Failed</span>;
  }
  if (verdict) {
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
        verdict === "Feasible" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
        : verdict === "Risky"  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
        : "bg-red-500/15 text-red-400 border border-red-500/20"
      }`}>{verdict}</span>
    );
  }
  return <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/[0.05] text-gray-500 border border-white/[0.08]">Pending</span>;
}

// ── Quick action card ──────────────────────────────────────────────────────────
function QuickCard({ icon, title, desc, href, accent }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group glass glass-hover rounded-2xl p-6 card-hover transition-all duration-200"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${accent}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-200 text-sm mb-1 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports]   = useState<ReportSummary[]>([]);
  const [loading, setLoading]   = useState(true);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/reports")
      .then(r => r.json())
      .then(d => { if (d.success) setReports(d.data); })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading") return null;

  const userName = (session?.user as { name?: string })?.name ?? "there";
  const completedCount  = reports.filter(r => r.status === "completed").length;
  const feasibleCount   = reports.filter(r => r.verdict === "Feasible").length;
  const avgScore = reports.filter(r => r.feasibility_score !== null).length > 0
    ? Math.round(reports.filter(r => r.feasibility_score !== null).reduce((s, r) => s + (r.feasibility_score ?? 0), 0) / reports.filter(r => r.feasibility_score !== null).length)
    : null;

  return (
    <>
      <SEO title="Dashboard" description="View your market research reports and activity." url={`${siteConfig.url}/dashboard`} noIndex />
      <AppShell>
        <div className="p-6 space-y-6">

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-violet-600/80 to-blue-600/80 glass rounded-2xl p-6 text-white border border-violet-500/20">
            <h1 className="text-xl font-bold mb-1">Welcome back, {userName.split(" ")[0]} 👋</h1>
            <p className="text-violet-200 text-sm">Here's a snapshot of your market research activity.</p>
            <Link
              href={ROUTES.analyze}
              className="inline-flex items-center gap-2 mt-4 bg-white/10 border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/20 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Analysis
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Reports",    value: reports.length.toString(),         sub: "all time",               color: "text-white" },
              { label: "Completed",        value: completedCount.toString(),          sub: "reports ready",          color: "text-white" },
              { label: "Feasible Ideas",   value: feasibleCount.toString(),           sub: "passed viability check", color: "text-emerald-400" },
              { label: "Avg Score",        value: avgScore !== null ? `${avgScore}/100` : "—", sub: "feasibility average", color: avgScore !== null ? scoreColor(avgScore) : "text-gray-500" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className={`text-3xl font-bold leading-none mb-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Onboarding checklist — shown only when user has no reports */}
          {!loading && reports.length === 0 && <OnboardingChecklist />}

          {/* Quick actions */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickCard
                href={ROUTES.analyze}
                title="New Market Research"
                desc="Analyze any business idea with AI-powered insights, financials, and risk assessment."
                accent="bg-violet-500/15 text-violet-400"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
              />
              <QuickCard
                href={ROUTES.compare}
                title="Compare Locations"
                desc="Run the same business idea across 2–3 cities side by side to find the best market."
                accent="bg-amber-500/15 text-amber-400"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                }
              />
              <QuickCard
                href={ROUTES.marketplace}
                title="Business Marketplace"
                desc="Browse vetted businesses for sale with AI-powered valuations and deal pipeline."
                accent="bg-blue-500/15 text-blue-400"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                }
              />
              <QuickCard
                href={ROUTES.partners}
                title="Find a Business Partner"
                desc="Connect with co-founders, investors, and operators looking for their next opportunity."
                accent="bg-emerald-500/15 text-emerald-400"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Recent reports */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Reports</h2>
              <Link href={ROUTES.analyze} className="text-xs text-violet-400 font-medium hover:text-violet-300 hover:underline">+ New Report</Link>
            </div>

            {loading ? (
              <div className="glass rounded-2xl p-8 flex justify-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-white font-semibold mb-1">No reports yet</p>
                <p className="text-gray-500 text-sm mb-4">Run your first market analysis to see results here.</p>
                <Link href={ROUTES.analyze} className="inline-block bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
                  Analyze a Business Idea
                </Link>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Business Idea</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Location</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Score</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Verdict</th>
                      <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-200 line-clamp-1">{r.business_brief}</p>
                          <p className="text-xs text-gray-500 mt-0.5 capitalize">{r.business_type}</p>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500 hidden sm:table-cell">{r.location}</td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          {r.feasibility_score !== null ? (
                            <span className={`text-sm font-bold ${scoreColor(r.feasibility_score)}`}>
                              {r.feasibility_score}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {statusBadge(r.status, r.verdict)}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 text-right hidden lg:table-cell">
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {r.status === "completed" && (
                            <Link
                              href={ROUTES.report(r.id)}
                              className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition"
                            >
                              View →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </AppShell>
    </>
  );
}
