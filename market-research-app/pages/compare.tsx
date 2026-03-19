import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { CompareResult, LocationResult } from "@/pages/api/compare";
import type { BudgetRange } from "@/lib/types";

// ── ZIP resolution ─────────────────────────────────────────────────────────────
async function resolveZip(zip: string): Promise<{ city: string; stateAbbr: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    return place ? { city: place["place name"], stateAbbr: place["state abbreviation"] } : null;
  } catch {
    return null;
  }
}

interface ZipEntry {
  zip: string;
  label: string;          // resolved "City, ST" — shown in UI
  resolving: boolean;
  error: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const businessTypes = [
  "Retail & E-Commerce", "Food & Beverage", "Health & Wellness",
  "Technology & SaaS", "Education & Coaching", "Professional Services",
  "Real Estate", "Manufacturing", "Hospitality & Travel", "Other",
];

const budgetRanges: { label: string; value: BudgetRange }[] = [
  { label: "Under $10k",     value: "under-10k" },
  { label: "$10k – $50k",    value: "10k-50k"   },
  { label: "$50k – $250k",   value: "50k-250k"  },
  { label: "$250k – $1M",    value: "250k-1m"   },
  { label: "Over $1M",       value: "over-1m"   },
];

const COMPARE_STEPS = [
  { label: "Gathering market data",     sub: "Querying live data for all locations in parallel…" },
  { label: "Running AI analyses",       sub: "Claude is evaluating each city independently…"     },
  { label: "Comparing results",         sub: "Scoring feasibility across all locations…"          },
];
const STEP_TIMES = [0, 30_000, 70_000];

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 70 ? "text-emerald-400" : s >= 45 ? "text-amber-400" : "text-red-400";
}
function scoreBg(s: number) {
  return s >= 70 ? "bg-emerald-500/15 border-emerald-500/20" : s >= 45 ? "bg-amber-500/15 border-amber-500/20" : "bg-red-500/15 border-red-500/20";
}
function scoreRing(s: number) {
  return s >= 70 ? "#10B981" : s >= 45 ? "#F59E0B" : "#EF4444";
}
function riskBadge(level: string) {
  return level === "Low"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
    : level === "Medium"
    ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
    : "bg-red-500/15 text-red-400 border-red-500/20";
}

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score, isWinner }: { score: number; isWinner: boolean }) {
  const R = 36; const SW = 7; const C = 2 * Math.PI * R;
  const arc = (score / 100) * C;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={96} height={96} className="-rotate-90">
        <circle cx={48} cy={48} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
        <circle
          cx={48} cy={48} r={R} fill="none"
          stroke={scoreRing(score)} strokeWidth={SW}
          strokeDasharray={`${arc} ${C - arc}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className={`text-xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">/100</span>
      </div>
      {isWinner && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-violet-500 to-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Location result card ──────────────────────────────────────────────────────
function LocationCard({ result, isWinner, rank }: { result: LocationResult; isWinner: boolean; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const medalColors = ["#F59E0B", "#9CA3AF", "#CD7C2F"];

  return (
    <div className={`glass rounded-2xl overflow-hidden transition-all ${
      isWinner ? "border border-violet-500/30 shadow-lg shadow-violet-500/10" : "border border-white/[0.08]"
    }`}>
      {/* Winner banner */}
      {isWinner && (
        <div className="bg-gradient-to-r from-violet-500/80 to-blue-500/80 text-white text-xs font-bold text-center py-1.5 tracking-wide uppercase">
          Best Location — Highest Feasibility Score
        </div>
      )}

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: medalColors[rank] ?? "#6B7280" }}
            >
              #{rank + 1}
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">{result.location}</h3>
              {result.error ? (
                <span className="text-xs text-red-400">{result.error}</span>
              ) : (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreBg(result.feasibility_score)}`}>
                  {result.verdict}
                </span>
              )}
            </div>
          </div>
          <ScoreRing score={result.feasibility_score} isWinner={isWinner} />
        </div>

        {!result.error && (
          <>
            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Risk Level",    value: result.risk_level,
                  badge: `text-xs font-semibold px-2 py-0.5 rounded-full border ${riskBadge(result.risk_level)}` },
                { label: "Break-Even",    value: `${result.break_even_months} months`, badge: null },
                { label: "High-Risk Items", value: `${result.high_risk_count} flagged`, badge: null },
              ].map((m) => (
                <div key={m.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{m.label}</p>
                  {m.badge ? (
                    <span className={m.badge}>{m.value}</span>
                  ) : (
                    <p className="text-sm font-bold text-gray-200">{m.value}</p>
                  )}
                </div>
              ))}

              {/* Score cards mini */}
              {result.score_cards.slice(0, 1).map((card) => (
                <div key={card.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
                  <p className={`text-sm font-bold ${scoreColor(card.score)}`}>{card.score}/100</p>
                </div>
              ))}
            </div>

            {/* Score cards row */}
            {result.score_cards.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {result.score_cards.map((card) => (
                  <div key={card.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-28 shrink-0 truncate">{card.label}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${card.score}%`,
                          backgroundColor: scoreRing(card.score),
                        }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold w-6 text-right ${scoreColor(card.score)}`}>{card.score}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">AI Recommendation</p>
              <p className="text-xs text-violet-200 leading-relaxed line-clamp-3">{result.final_recommendation}</p>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full text-xs font-semibold text-violet-400 hover:text-violet-300 transition flex items-center justify-center gap-1"
            >
              {expanded ? "Hide details" : "Show full analysis"}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {expanded && (
              <div className="mt-4 space-y-3 border-t border-white/[0.05] pt-4">
                {[
                  { title: "Market Overview",     body: result.market_overview },
                  { title: "Competitor Analysis", body: result.competitor_analysis },
                  { title: "Pricing Insights",    body: result.pricing_insights },
                  { title: "Startup Cost Est.",   body: result.startup_cost_estimate },
                ].map(({ title, body }) => body ? (
                  <div key={title}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
                  </div>
                ) : null)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [businessBrief, setBusinessBrief] = useState("");
  const [businessType,  setBusinessType]  = useState("");
  const [budget,        setBudget]        = useState<BudgetRange | "">("");
  const [zipEntries,    setZipEntries]    = useState<ZipEntry[]>([
    { zip: "", label: "", resolving: false, error: null },
    { zip: "", label: "", resolving: false, error: null },
    { zip: "", label: "", resolving: false, error: null },
  ]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [result,        setResult]        = useState<CompareResult | null>(null);
  const [currentStep,   setCurrentStep]   = useState(0);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const zipTimersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null]);

  // Step advancement while loading
  useEffect(() => {
    if (!loading) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setCurrentStep(0);
      return;
    }
    setCurrentStep(0);
    STEP_TIMES.slice(1).forEach((ms, i) => {
      const t = setTimeout(() => setCurrentStep(i + 1), ms);
      timersRef.current.push(t);
    });
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [loading]);

  function updateZip(idx: number, rawZip: string) {
    const zip = rawZip.replace(/\D/g, "").slice(0, 5);
    setZipEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], zip, label: "", error: null, resolving: false };
      return next;
    });

    if (zipTimersRef.current[idx]) clearTimeout(zipTimersRef.current[idx]!);
    if (zip.length !== 5) return;

    setZipEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], resolving: true };
      return next;
    });

    zipTimersRef.current[idx] = setTimeout(async () => {
      const info = await resolveZip(zip);
      setZipEntries(prev => {
        const next = [...prev];
        if (info) {
          next[idx] = { zip, label: `${info.city}, ${info.stateAbbr}`, resolving: false, error: null };
        } else {
          next[idx] = { zip, label: "", resolving: false, error: "ZIP not found" };
        }
        return next;
      });
    }, 400);
  }

  const validEntries = zipEntries.filter(e => /^\d{5}$/.test(e.zip) && e.label);
  const filledZips   = validEntries.length;
  const isReady      = businessBrief.trim().length >= 3 && businessType && budget && filledZips >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessBrief: businessBrief.trim(),
          businessType,
          budget,
          zipEntries: validEntries.map(e => ({ zip: e.zip, label: e.label })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Comparison failed");
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  // Sort results by score descending
  const sortedResults = result
    ? [...result.locations].sort((a, b) => b.feasibility_score - a.feasibility_score)
    : [];

  return (
    <>
      <Head>
        <title>{`Location Comparison — ${siteConfig.name}`}</title>
      </Head>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-[#09090b] flex items-center justify-center px-6">
          <div className="max-w-md w-full">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/20">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Comparing {filledZips} ZIP codes
              </h2>
              <p className="text-sm text-gray-400">Running AI analyses in parallel. Takes 90–120 seconds.</p>
            </div>

            <div className="space-y-5 mb-10">
              {COMPARE_STEPS.map((step, i) => {
                const done   = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      done ? "bg-emerald-500/15 border border-emerald-500/20" : active ? "bg-violet-500/15 border border-violet-500/20" : "bg-white/[0.04] border border-white/[0.08]"
                    }`}>
                      {done ? (
                        <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : active ? (
                        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-600 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${done ? "text-emerald-400" : active ? "text-violet-300" : "text-gray-600"}`}>{step.label}</p>
                      {active && <p className="text-xs text-violet-400 mt-0.5 animate-pulse">{step.sub}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${((currentStep + 1) / COMPARE_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">Step {currentStep + 1} of {COMPARE_STEPS.length}</p>
          </div>
        </div>
      )}

      <AppShell>
        <div className="p-6 space-y-6 max-w-6xl mx-auto">

          {/* Page header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Location Comparison</h1>
              <p className="text-sm text-gray-400 mt-1">
                Compare the same business idea across 2–3 cities side by side.
              </p>
            </div>
            <Link
              href={ROUTES.analyze}
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 hover:underline whitespace-nowrap"
            >
              Single analysis →
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-6">

            {/* Business brief */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Business Idea</label>
              <textarea
                rows={3}
                value={businessBrief}
                onChange={e => setBusinessBrief(e.target.value)}
                placeholder="Describe your business idea and target customer…"
                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.05] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm resize-none"
              />
            </div>

            {/* Type + Budget */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Business Type</label>
                <div className="relative">
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.05] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm"
                  >
                    <option value="" disabled style={{ background: '#09090b' }}>Select industry…</option>
                    {businessTypes.map(t => <option key={t} value={t} style={{ background: '#09090b' }}>{t}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▼</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Budget</label>
                <div className="relative">
                  <select
                    value={budget}
                    onChange={e => setBudget(e.target.value as BudgetRange)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.05] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm"
                  >
                    <option value="" disabled style={{ background: '#09090b' }}>Select range…</option>
                    {budgetRanges.map(b => <option key={b.value} value={b.value} style={{ background: '#09090b' }}>{b.label}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▼</span>
                </div>
              </div>
            </div>

            {/* ZIP Code inputs */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                ZIP Codes to Compare <span className="text-gray-500 font-normal">(fill 2 or 3 — searches within 1 mile each)</span>
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                {zipEntries.map((entry, i) => (
                  <div key={i}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                        {["A", "B", "C"][i]}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={entry.zip}
                        onChange={e => updateZip(i, e.target.value)}
                        placeholder={i < 2 ? `ZIP code ${i + 1}` : "ZIP code 3 (optional)"}
                        className={`w-full pl-8 pr-8 py-3 rounded-xl border bg-white/[0.05] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm ${
                          entry.error ? "border-red-500/40" : entry.label ? "border-emerald-500/30" : "border-white/[0.08]"
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                        {entry.resolving && <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
                        {entry.label && !entry.resolving && (
                          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </div>
                    {entry.label && (
                      <p className="mt-1 text-xs text-emerald-400 font-medium pl-1">📍 {entry.label}</p>
                    )}
                    {entry.error && (
                      <p className="mt-1 text-xs text-red-400 pl-1">{entry.error}</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {filledZips >= 2
                  ? `${filledZips} valid ZIP codes ready — competitor data within 1 mile of each`
                  : "Enter at least 2 valid 5-digit US ZIP codes to compare."}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isReady || loading}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                isReady && !loading
                  ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white glow-button cursor-pointer"
                  : "bg-white/[0.03] border border-white/[0.08] text-gray-600 cursor-not-allowed"
              }`}
            >
              {loading
                ? "Analyzing all ZIP codes…"
                : isReady
                ? `Compare ${filledZips} Locations →`
                : "Fill in all fields to continue"}
            </button>
          </form>

          {/* Results */}
          {result && !loading && (
            <div className="space-y-5">
              {/* Summary banner */}
              <div className="bg-gradient-to-r from-violet-600/70 to-blue-600/70 glass rounded-2xl p-5 text-white border border-violet-500/20">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-300 mb-1">Comparison Complete</p>
                <h2 className="text-lg font-bold mb-1">
                  Best location for <span className="text-violet-200">{result.businessBrief.slice(0, 60)}{result.businessBrief.length > 60 ? "…" : ""}</span>
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold">
                    {result.winner} wins with a score of{" "}
                    {sortedResults[0]?.feasibility_score ?? "—"}/100
                  </p>
                </div>
              </div>

              {/* Score summary bar */}
              <div className="glass rounded-2xl p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Feasibility Score at a Glance</p>
                <div className="space-y-3">
                  {sortedResults.map((r, i) => (
                    <div key={r.location} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 w-4">#{i + 1}</span>
                      <span className="text-sm text-gray-300 w-32 truncate">{r.location}</span>
                      <div className="flex-1 h-3 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${r.feasibility_score}%`, backgroundColor: scoreRing(r.feasibility_score) }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${scoreColor(r.feasibility_score)}`}>
                        {r.feasibility_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location cards */}
              <div className={`grid gap-5 ${sortedResults.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
                {sortedResults.map((loc, i) => (
                  <LocationCard
                    key={loc.location}
                    result={loc}
                    isWinner={loc.location === result.winner}
                    rank={i}
                  />
                ))}
              </div>

              {/* CTA */}
              <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white text-sm">Ready to go deeper on {result.winner}?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Run a full 10-section report with financials, milestones & PDF export.</p>
                </div>
                <Link
                  href={`/analyze?brief=${encodeURIComponent(result.businessBrief)}&location=${encodeURIComponent(result.winner)}&type=${encodeURIComponent(result.businessType)}&budget=${encodeURIComponent(result.budget)}&zip=${encodeURIComponent(sortedResults[0]?.zip_code ?? "")}`}
                  className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition whitespace-nowrap"
                >
                  Full Report for {result.winner} →
                </Link>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </>
  );
}
