import { useEffect, useState, useMemo } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { ReportSummary } from "@/pages/api/reports";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-500";
  return score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-white/[0.05]";
  return score >= 70 ? "bg-emerald-500/15" : score >= 45 ? "bg-amber-500/15" : "bg-red-500/15";
}

// ── Badge components ───────────────────────────────────────────────────────────

function VerdictBadge({ verdict, status }: { verdict: string | null; status: string }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 animate-pulse">
        Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
        Failed
      </span>
    );
  }
  if (!verdict) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.05] text-gray-500 border border-white/[0.08]">
        —
      </span>
    );
  }
  const cls =
    verdict === "Feasible"
      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
      : verdict === "Risky"
      ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
      : "bg-red-500/15 text-red-400 border border-red-500/20";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      {verdict}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; label: string }> = {
    completed: { dot: "bg-emerald-400", label: "Completed" },
    processing: { dot: "bg-blue-400 animate-pulse", label: "Processing" },
    failed:     { dot: "bg-red-400",   label: "Failed" },
    pending:    { dot: "bg-gray-500",  label: "Pending" },
  };
  const { dot, label } = cfg[status] ?? { dot: "bg-gray-500", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

// ── Budget display map ─────────────────────────────────────────────────────────

const BUDGET_LABELS: Record<string, string> = {
  "under-10k":  "< $10k",
  "10k-50k":    "$10k – $50k",
  "50k-250k":   "$50k – $250k",
  "250k-1m":    "$250k – $1M",
  "over-1m":    "> $1M",
};

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconFileX() {
  return (
    <svg className="w-10 h-10 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="10" y1="12" x2="14" y2="16" /><line x1="14" y1="12" x2="10" y2="16" />
    </svg>
  );
}

// ── Unique business types from report list ─────────────────────────────────────

function useBusinessTypes(reports: ReportSummary[]) {
  return useMemo(() => {
    const types = Array.from(new Set(reports.map((r) => r.business_type))).sort();
    return types;
  }, [reports]);
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MyReportsPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  const [reports, setReports]     = useState<ReportSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Redirect unauthenticated users
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(ROUTES.login);
    }
  }, [authStatus, router]);

  // Fetch reports once session is confirmed
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    setLoading(true);
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setReports(d.data as ReportSummary[]);
        } else {
          setFetchError(d.error ?? "Failed to load reports.");
        }
      })
      .catch(() => setFetchError("Network error. Please refresh."))
      .finally(() => setLoading(false));
  }, [authStatus]);

  const businessTypes = useBusinessTypes(reports);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesType = typeFilter ? r.business_type === typeFilter : true;
      const matchesSearch = search
        ? r.business_brief.toLowerCase().includes(search.toLowerCase()) ||
          r.location.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesType && matchesSearch;
    });
  }, [reports, search, typeFilter]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (authStatus === "loading" || (authStatus === "authenticated" && loading)) {
    return (
      <AppShell>
        <div className="p-6 space-y-4">
          <div className="h-8 w-48 bg-white/[0.06] rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-white/[0.04] rounded-2xl animate-pulse" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-full glass rounded-2xl animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <AppShell>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-white mb-2">Could not load reports</h2>
            <p className="text-sm text-gray-400 mb-5">{fetchError}</p>
            <button
              onClick={() => { setFetchError(null); setLoading(true); fetch("/api/reports").then(r => r.json()).then(d => { if (d.success) setReports(d.data); else setFetchError(d.error ?? "Error"); }).catch(() => setFetchError("Network error.")).finally(() => setLoading(false)); }}
              className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Retry
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <SEO title="My Reports" description="All your market research reports in one place." url={`${siteConfig.url}/reports`} noIndex />

      <AppShell>
        <div className="p-6 space-y-5">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">My Reports</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {reports.length === 0
                  ? "No analyses yet"
                  : `${reports.length} analysis report${reports.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Link
              href={ROUTES.analyze}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0"
            >
              <IconPlus />
              New Analysis
            </Link>
          </div>

          {/* Filter bar */}
          {reports.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Text search */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 pointer-events-none">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by business idea or location…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 placeholder-gray-600"
                />
              </div>

              {/* Business type filter */}
              {businessTypes.length > 1 && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="text-sm bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 cursor-pointer"
                >
                  <option value="" style={{ background: '#09090b' }}>All business types</option>
                  {businessTypes.map((t) => (
                    <option key={t} value={t} style={{ background: '#09090b' }}>{t}</option>
                  ))}
                </select>
              )}

              {/* Clear filters */}
              {(search || typeFilter) && (
                <button
                  onClick={() => { setSearch(""); setTypeFilter(""); }}
                  className="text-sm text-violet-400 hover:text-violet-300 font-medium px-1 transition"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Empty state — no reports at all */}
          {reports.length === 0 && (
            <div className="glass rounded-2xl p-16 flex flex-col items-center justify-center text-center">
              <IconFileX />
              <h2 className="mt-5 text-lg font-bold text-white">No reports yet</h2>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">
                Run your first market analysis to see a feasibility report, competitive insights, and financial projections.
              </p>
              <Link
                href={ROUTES.analyze}
                className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                <IconPlus />
                Start Analysis
              </Link>
            </div>
          )}

          {/* Empty state — filters returned nothing */}
          {reports.length > 0 && filtered.length === 0 && (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <span className="text-gray-600"><IconSearch /></span>
              <h2 className="mt-4 text-base font-semibold text-white">No matching reports</h2>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter.</p>
              <button
                onClick={() => { setSearch(""); setTypeFilter(""); }}
                className="mt-4 text-sm text-violet-400 hover:text-violet-300 font-medium transition"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Reports table */}
          {filtered.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              {/* Desktop header row */}
              <div className="hidden md:grid grid-cols-[1fr_120px_130px_110px_100px_80px_120px] gap-4 px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Business Idea</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Type</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Location</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Budget</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Score</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Verdict</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</span>
              </div>

              <ul className="divide-y divide-white/[0.05]">
                {filtered.map((report) => (
                  <li key={report.id}>
                    <Link
                      href={ROUTES.report(report.id)}
                      className="group flex flex-col md:grid md:grid-cols-[1fr_120px_130px_110px_100px_80px_120px] md:items-center gap-3 md:gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Business idea + status */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-200 truncate group-hover:text-violet-300 transition-colors">
                          {report.business_brief}
                        </p>
                        <div className="mt-0.5">
                          <StatusDot status={report.status} />
                        </div>
                      </div>

                      {/* Business type */}
                      <span className="text-xs text-gray-500 truncate">{report.business_type}</span>

                      {/* Location */}
                      <span className="text-xs text-gray-500 truncate">{report.location}</span>

                      {/* Budget */}
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {BUDGET_LABELS[report.budget] ?? report.budget}
                      </span>

                      {/* Score pill */}
                      <span
                        className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-bold ${scoreBg(report.feasibility_score)} ${scoreColor(report.feasibility_score)}`}
                      >
                        {report.feasibility_score !== null ? report.feasibility_score : "—"}
                      </span>

                      {/* Verdict badge */}
                      <VerdictBadge verdict={report.verdict} status={report.status} />

                      {/* Date + view button */}
                      <div className="flex items-center justify-between md:justify-start md:gap-2">
                        <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                        <span className="ml-auto md:ml-0 text-gray-600 group-hover:text-violet-400 transition-colors">
                          <IconChevronRight />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Table footer */}
              <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Showing {filtered.length} of {reports.length} report{reports.length !== 1 ? "s" : ""}
                </span>
                <Link
                  href={ROUTES.analyze}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition"
                >
                  <IconPlus />
                  New Analysis
                </Link>
              </div>
            </div>
          )}

        </div>
      </AppShell>
    </>
  );
}