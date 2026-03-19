import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { Report, ScoreCard, RiskItem, ChartItem, BurnPoint, BreakEvenData } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "competitors" | "pricing" | "demand" | "risk" | "startup-cost" | "opex" | "burn" | "break-even";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "competitors",  label: "Competitors" },
  { id: "pricing",      label: "Pricing" },
  { id: "demand",       label: "Demand" },
  { id: "risk",         label: "Risk" },
  { id: "startup-cost", label: "Startup Cost" },
  { id: "opex",         label: "OpEx" },
  { id: "burn",         label: "6M Burn" },
  { id: "break-even",   label: "Break-Even" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 70 ? "#10B981" : s >= 45 ? "#F59E0B" : "#EF4444";
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ── Icons (only those used in this page) ──────────────────────────────────────
function IconDownload() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

// ── SVG Multi-Series Line Chart ────────────────────────────────────────────────
function LineChart({ points }: { points: BurnPoint[] }) {
  if (!points.length) return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400">No burn data</div>
  );

  const W = 560, H = 200;
  const pad = { t: 16, r: 16, b: 36, l: 52 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;

  // Safe fallback for legacy data without fixed/variable split
  const pts = points.map(p => ({
    ...p,
    fixed_expenses:    p.fixed_expenses    ?? Math.round(p.expenses * 0.6),
    variable_expenses: p.variable_expenses ?? Math.round(p.expenses * 0.4),
  }));

  const allVals = pts.flatMap(p => [p.revenue, p.fixed_expenses, p.variable_expenses]);
  const maxV = Math.max(...allVals, 1);

  const cx = (i: number) => pad.l + (pts.length === 1 ? iW / 2 : (i / (pts.length - 1)) * iW);
  const cy = (v: number) => pad.t + iH - (v / maxV) * iH;

  function mkPath(vals: number[]) {
    return vals.map((v, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(v)}`).join(" ");
  }

  const revenueLine  = mkPath(pts.map(p => p.revenue));
  const revenueArea  = `${revenueLine} L${cx(pts.length - 1)},${pad.t + iH} L${pad.l},${pad.t + iH}Z`;
  const fixedLine    = mkPath(pts.map(p => p.fixed_expenses));
  const variableLine = mkPath(pts.map(p => p.variable_expenses));

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const totalBurn   = pts.reduce((s, p) => s + p.expenses, 0);
  const totalInflow = pts.reduce((s, p) => s + p.revenue, 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 150 }}>
        <defs>
          <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} y1={cy(maxV * t)} x2={W - pad.r} y2={cy(maxV * t)} stroke="#F3F4F6" strokeWidth="1" />
            <text x={pad.l - 6} y={cy(maxV * t)} textAnchor="end" fontSize="9" fill="#9CA3AF" dominantBaseline="middle">
              {fmtMoney(maxV * t)}
            </text>
          </g>
        ))}

        {/* Revenue area + line (green) */}
        <path d={revenueArea} fill="url(#inflowGrad)" />
        <path d={revenueLine} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Fixed expenses — solid red */}
        <path d={fixedLine} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Variable expenses — dashed amber */}
        <path d={variableLine} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={cx(i)} cy={cy(p.revenue)}           r="3.5" fill="#10B981" stroke="white" strokeWidth="1.5" />
            <circle cx={cx(i)} cy={cy(p.fixed_expenses)}    r="3.5" fill="#EF4444" stroke="white" strokeWidth="1.5" />
            <circle cx={cx(i)} cy={cy(p.variable_expenses)} r="3.5" fill="#F59E0B" stroke="white" strokeWidth="1.5" />
          </g>
        ))}

        {/* X labels */}
        {pts.map((p, i) => (
          <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#9CA3AF">
            {p.month}
          </text>
        ))}
      </svg>

      {/* Legend + totals */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-5 h-0.5 bg-emerald-500 rounded-full inline-block" />
            Inflow
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-5 h-0.5 bg-red-500 rounded-full inline-block" />
            Fixed (Compulsory)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <svg width="20" height="4" className="inline-block">
              <line x1="0" y1="2" x2="20" y2="2" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            Variable (Floating)
          </span>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="text-emerald-600">Inflow: {fmtMoney(totalInflow)}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-800">Burn: {fmtMoney(totalBurn)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart (used for OpEx) ──────────────────────────────────────
function HBarChart({ items, color = "#6366F1" }: { items: ChartItem[]; color?: string }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span className="truncate mr-2">{item.label}</span>
            <span className="font-semibold shrink-0">${item.value.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cost Breakdown Chart (Startup Costs) ───────────────────────────────────────
const COST_PALETTE = [
  "#6366F1", "#3B82F6", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#14B8A6", "#8B5CF6",
  "#F97316", "#84CC16",
];

function CostBreakdownChart({ items }: { items: ChartItem[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="text-sm text-gray-400">No data available</p>;

  const sorted = [...items]
    .sort((a, b) => b.value - a.value)
    .map((item, i) => ({
      ...item,
      color: COST_PALETTE[i % COST_PALETTE.length],
      pct: Math.round((item.value / total) * 100),
    }));

  // Donut geometry
  const R = 52, CX = 68, CY = 68, SW = 18;
  const C = 2 * Math.PI * R;
  const GAP = 3;

  let accumulated = 0;
  const segments = sorted.map((item) => {
    const arcLen = Math.max((item.value / total) * C - GAP, 0);
    const seg = { ...item, arcLen, accumulated };
    accumulated += (item.value / total) * C;
    return seg;
  });

  const topItem = sorted[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Investment</p>
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">{sorted.length} cost categories</p>
          <p className="text-xs text-gray-500">
            Largest: <span className="font-semibold" style={{ color: topItem.color }}>
              {topItem.label.split(" ")[0]}
            </span>{" "}
            <span className="text-gray-400">({topItem.pct}%)</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Donut ring */}
        <div className="flex items-center justify-center shrink-0 self-start">
          <div className="relative">
            <svg width={CX * 2} height={CY * 2}>
              {/* Background ring */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={SW} />

              {/* Color segments — dashoffset from C/4 starts arc at 12 o'clock */}
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeDasharray={`${seg.arcLen} ${C - seg.arcLen}`}
                  strokeDashoffset={C / 4 - seg.accumulated}
                  strokeLinecap="butt"
                />
              ))}

              {/* Center label */}
              <text x={CX} y={CY - 8} textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
                {sorted.length}
              </text>
              <text x={CX} y={CY + 9} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontWeight="600">
                ITEMS
              </text>
            </svg>
          </div>
        </div>

        {/* Ranked list */}
        <div className="flex-1 space-y-3 min-w-0">
          {sorted.map((item, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-1">
                {/* Rank */}
                <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: item.color + "18", color: item.color }}>
                  {i + 1}
                </span>
                <span className="text-xs text-gray-700 flex-1 truncate">{item.label}</span>
                {/* Percentage badge */}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums"
                  style={{ backgroundColor: item.color + "18", color: item.color }}>
                  {item.pct}%
                </span>
                {/* Amount */}
                <span className="text-xs font-bold text-gray-900 shrink-0 tabular-nums w-16 text-right">
                  ${item.value.toLocaleString()}
                </span>
              </div>
              {/* Gradient bar */}
              <div className="h-2 bg-gray-100 rounded-full ml-6 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.pct}%`,
                    background: `linear-gradient(90deg, ${item.color}, ${item.color}99)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color legend chips */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
        {sorted.map((item, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            {item.label.length > 22 ? item.label.slice(0, 20) + "…" : item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Break-Even Timeline ────────────────────────────────────────────────────────
function BreakEvenTimeline({ be }: { be: BreakEvenData }) {
  const months = be.estimated_months_to_break_even;
  const maxM   = Math.max(months + 6, 24);
  const pct    = Math.min((months / maxM) * 100, 100);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Monthly Fixed Costs",    value: `$${be.monthly_fixed_costs.toLocaleString()}` },
          { label: "Avg Transaction Value",  value: `$${be.avg_transaction_value.toLocaleString()}` },
          { label: "Variable Cost %",        value: `${be.variable_cost_pct}%` },
          { label: "Transactions/Mo Needed", value: be.monthly_transactions_needed.toLocaleString() },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium mt-1.5">
          <span className="text-gray-400">MONTH 0</span>
          <span className="text-indigo-600">MONTH {months} (TARGET)</span>
          <span className="text-gray-400">MONTH {maxM}</span>
        </div>
      </div>
    </div>
  );
}

// ── Risk Matrix dark card ──────────────────────────────────────────────────────
function RiskMatrix({ items }: { items: RiskItem[] }) {
  if (!items.length) return <p className="text-gray-500 text-xs">No risk data available.</p>;

  const tagged = items.map(item => {
    const isHigh = item.probability === "High" || item.impact === "High";
    const isMed  = !isHigh && (item.probability === "Medium" || item.impact === "Medium");
    return { ...item, tier: isHigh ? "high" : isMed ? "medium" : "low" };
  });

  const dot:   Record<string, string> = { high: "bg-red-500",    medium: "bg-orange-400", low: "bg-green-500"  };
  const txt:   Record<string, string> = { high: "text-red-400",  medium: "text-orange-400", low: "text-green-400" };
  const label: Record<string, string> = { high: "HIGH SEVERITY", medium: "MEDIUM SEVERITY", low: "LOW SEVERITY" };

  const sorted = ["high", "medium", "low"].flatMap(t => tagged.filter(i => i.tier === t)).slice(0, 4);

  return (
    <div className="space-y-3">
      {sorted.map((item, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot[item.tier]}`} />
            <span className={`text-[10px] font-bold tracking-widest ${txt[item.tier]}`}>{label[item.tier]}</span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed">{item.risk}</p>
        </div>
      ))}
    </div>
  );
}

// ── Score Dimension Cards ──────────────────────────────────────────────────────
function ScoreDimensions({ cards }: { cards: ScoreCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 truncate">{c.label}</span>
            <span className="text-xs font-bold ml-1 shrink-0" style={{ color: scoreColor(c.score) }}>{c.score}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div className="h-1.5 rounded-full" style={{ width: `${c.score}%`, backgroundColor: scoreColor(c.score) }} />
          </div>
          <p className="text-[10px] font-bold uppercase" style={{ color: scoreColor(c.score) }}>{c.verdict}</p>
          <p className="text-[10px] text-gray-400 mt-1 leading-snug line-clamp-2">{c.description}</p>
        </div>
      ))}
    </div>
  );
}

// ── Plain section card ─────────────────────────────────────────────────────────
function SectionCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{content || "No data available."}</p>
    </div>
  );
}

// ── Risk Heatmap ───────────────────────────────────────────────────────────────
function RiskHeatmap({ items }: { items: RiskItem[] }) {
  const badge: Record<string, string> = {
    High:   "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low:    "bg-green-50 text-green-700",
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 mb-1">{item.risk}</p>
            <p className="text-xs text-gray-500 leading-snug">{item.mitigation}</p>
          </div>
          <div className="flex gap-2 items-start shrink-0">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badge[item.probability]}`}>P: {item.probability}</span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badge[item.impact]}`}>I: {item.impact}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Milestone Slideshow ────────────────────────────────────────────────────────
const MILESTONE_THEME = [
  { badge: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3", tag: "#E0E7FF" },
  { badge: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", text: "#5B21B6", tag: "#EDE9FE" },
  { badge: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", tag: "#DBEAFE" },
  { badge: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", tag: "#D1FAE5" },
  { badge: "#F97316", bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412", tag: "#FFEDD5" },
];

// Keywords to enrich image search per common milestone words
function buildImgQuery(businessType: string, title: string): string {
  const biz = businessType.replace(/[&]/g, "").replace(/\s+/g, "+").toLowerCase();
  const noiseWords = new Set(["and","the","of","for","to","a","in","with","on","at","by"]);
  const titleWords = title.split(/\s+/)
    .filter(w => !noiseWords.has(w.toLowerCase()) && w.length > 2)
    .slice(0, 2)
    .join("+")
    .toLowerCase();
  return encodeURIComponent(`${biz} ${titleWords}`).replace(/%20/g, "+");
}

function MilestoneTimeline({ milestones, businessType, businessBrief }: {
  milestones: Report["milestones"];
  businessType: string;
  businessBrief: string;
}) {
  const [current, setCurrent] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const total = milestones.length;

  const prev = () => setCurrent(i => (i - 1 + total) % total);
  const next = () => setCurrent(i => (i + 1) % total);

  const m = milestones[current];
  const c = MILESTONE_THEME[current % MILESTONE_THEME.length];
  const imgQuery = buildImgQuery(businessType || businessBrief, m.title);
  const imgUrl = `https://source.unsplash.com/featured/800x400/?${imgQuery}&sig=${current}`;

  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: c.border }}>

      {/* ── Hero image with overlay ── */}
      <div className="relative h-52 overflow-hidden group" style={{ backgroundColor: c.bg }}>
        {!imgErrors.has(current) ? (
          <img
            key={current}
            src={imgUrl}
            alt={m.title}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={() => setImgErrors(prev => new Set([...prev, current]))}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${c.badge}30, ${c.badge}10)` }}
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        {/* Month badge */}
        <div className="absolute top-3 left-3">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white shadow"
            style={{ backgroundColor: c.badge }}
          >
            Month {m.month}
          </span>
        </div>

        {/* Slide counter top-right */}
        <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
          {current + 1} / {total}
        </div>

        {/* Title on image */}
        <div className="absolute bottom-4 left-4 right-16">
          <h4 className="text-white text-base font-bold leading-snug drop-shadow">{m.title}</h4>
        </div>

        {/* Nav arrows */}
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Tasks ── */}
      <div className="px-5 pt-4 pb-3" style={{ backgroundColor: c.bg }}>
        <ul className="space-y-2">
          {m.tasks.map((task, j) => (
            <li key={j} className="flex items-start gap-2.5 text-xs text-gray-700 leading-snug">
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5.5" fill={c.tag} stroke={c.border} />
                <path d="M3.5 6L5.5 8L8.5 4" stroke={c.badge} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {task}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Dot nav + arrows ── */}
      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ backgroundColor: c.bg, borderColor: c.border }}>
        <button
          onClick={prev}
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: c.badge }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Prev
        </button>

        <div className="flex items-center gap-1.5">
          {milestones.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width:           i === current ? 20 : 6,
                height:          6,
                backgroundColor: i === current ? c.badge : c.border,
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: c.badge }}
        >
          Next
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Setup Checklist ────────────────────────────────────────────────────────────
function SetupChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const done  = checked.size;
  const total = items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-700">{done} of {total} completed</span>
          <span
            className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: allDone ? "#D1FAE5" : pct > 50 ? "#EDE9FE" : "#EEF2FF",
              color: allDone ? "#065F46" : pct > 50 ? "#6D28D9" : "#4338CA",
            }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: allDone
                ? "linear-gradient(90deg, #10B981, #34D399)"
                : "linear-gradient(90deg, #6366F1, #8B5CF6)",
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const isChecked = checked.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                isChecked
                  ? "bg-indigo-50 border border-indigo-100"
                  : "bg-gray-50 border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40"
              }`}
            >
              {/* Custom checkbox */}
              <div
                className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200 ${
                  isChecked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                }`}
              >
                {isChecked && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className={`text-xs leading-snug transition-all duration-200 ${
                  isChecked ? "text-indigo-500 line-through opacity-60" : "text-gray-600"
                }`}
              >
                {item}
              </span>
            </button>
          );
        })}
      </div>

      {/* Completion celebration */}
      {allDone && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-xs font-bold text-emerald-700">All setup tasks completed — you're ready to launch!</p>
        </div>
      )}
    </div>
  );
}

// ── Financial Dashboard ────────────────────────────────────────────────────────
function FinancialDashboard({ points }: { points: BurnPoint[] }) {
  if (!points.length) return null;

  const pts = points.map(p => ({
    ...p,
    fixed_expenses:    p.fixed_expenses    ?? Math.round(p.expenses * 0.6),
    variable_expenses: p.variable_expenses ?? Math.round(p.expenses * 0.4),
  }));

  const totalRevenue  = pts.reduce((s, p) => s + p.revenue, 0);
  const totalVariable = pts.reduce((s, p) => s + p.variable_expenses, 0);
  const totalFixed    = pts.reduce((s, p) => s + p.fixed_expenses, 0);
  const grossProfit   = totalRevenue - totalVariable;
  const netProfit     = grossProfit - totalFixed;

  function renderPLWaterfall() {
    const W = 420, H = 200;
    const pad = { t: 24, r: 16, b: 36, l: 16 };
    const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
    const minV = Math.min(0, netProfit) * 1.1;
    const maxV = Math.max(totalRevenue * 1.15, 1);
    const range = maxV - minV;
    const cy = (v: number) => pad.t + iH - ((v - minV) / range) * iH;
    const colW = iW / 5; const barW = colW * 0.55;
    const cx = (i: number) => pad.l + colW * i + (colW - barW) / 2;
    const baseY = cy(0);
    const bars = [
      { label: "Revenue",    val: fmtMoney(totalRevenue),  y1: cy(totalRevenue), y2: baseY,           color: "#10B981" },
      { label: "Variable",   val: fmtMoney(totalVariable), y1: cy(totalRevenue), y2: cy(grossProfit), color: "#EF4444" },
      { label: "Gross P.",   val: fmtMoney(grossProfit),   y1: cy(grossProfit),  y2: baseY,           color: "#3B82F6" },
      { label: "Fixed",      val: fmtMoney(totalFixed),    y1: cy(grossProfit),  y2: cy(netProfit),   color: "#F97316" },
      { label: "Net Profit", val: fmtMoney(netProfit),
        y1: netProfit >= 0 ? cy(netProfit) : baseY,
        y2: netProfit >= 0 ? baseY : cy(netProfit),
        color: netProfit >= 0 ? "#10B981" : "#EF4444" },
    ];
    const connY = [cy(totalRevenue), cy(grossProfit), cy(grossProfit), cy(Math.max(netProfit, 0))];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY} stroke="#E5E7EB" strokeWidth="1" />
        {connY.map((y, i) => (
          <line key={i} x1={cx(i) + barW} y1={y} x2={cx(i + 1)} y2={y}
            stroke="#D1D5DB" strokeWidth="0.8" strokeDasharray="3 2" />
        ))}
        {bars.map((b, i) => {
          const topY = Math.min(b.y1, b.y2);
          const barH = Math.max(Math.abs(b.y2 - b.y1), 2);
          return (
            <g key={i}>
              <rect x={cx(i)} y={topY} width={barW} height={barH} rx="3" fill={b.color} opacity="0.85" />
              <text x={cx(i) + barW / 2} y={topY - 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={b.color}>{b.val}</text>
              <text x={cx(i) + barW / 2} y={H - 8} textAnchor="middle" fontSize="7.5" fill="#6B7280">{b.label}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  function renderMarginsChart() {
    const W = 420, H = 150;
    const pad = { t: 20, r: 16, b: 26, l: 38 };
    const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
    const data = pts.map(p => ({
      month: p.month.replace("Month ", "M"),
      gross: p.revenue > 0 ? ((p.revenue - p.variable_expenses) / p.revenue) * 100 : 0,
      net:   p.revenue > 0 ? (p.net / p.revenue) * 100 : 0,
    }));
    const allV = data.flatMap(d => [d.gross, d.net]);
    const minV = Math.floor(Math.min(...allV, -5) / 10) * 10;
    const maxV = Math.ceil( Math.max(...allV,  5) / 10) * 10;
    const range = maxV - minV || 1;
    const cx = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iW : iW / 2);
    const cy = (v: number) => pad.t + iH - ((v - minV) / range) * iH;
    const zero = cy(0);
    const mkPath = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="gmGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <line x1={pad.l} y1={zero} x2={W - pad.r} y2={zero} stroke="#E5E7EB" strokeWidth="1" />
        {[minV, Math.round((minV + maxV) / 2), maxV].map((v, i) => (
          <g key={i}>
            <line x1={pad.l} y1={cy(v)} x2={W - pad.r} y2={cy(v)} stroke="#F3F4F6" strokeWidth="0.5" />
            <text x={pad.l - 4} y={cy(v)} textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">{v}%</text>
          </g>
        ))}
        <path d={`${mkPath(data.map(d => d.gross))} L${cx(data.length - 1).toFixed(1)},${zero.toFixed(1)} L${pad.l},${zero.toFixed(1)}Z`} fill="url(#gmGrad)" />
        <path d={mkPath(data.map(d => d.gross))} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={mkPath(data.map(d => d.net))} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4 2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={cx(i)} cy={cy(d.gross)} r="2.5" fill="#3B82F6" stroke="white" strokeWidth="1.2" />
            <circle cx={cx(i)} cy={cy(d.net)}   r="2.5" fill="#8B5CF6" stroke="white" strokeWidth="1.2" />
            <text x={cx(i)} y={H - 5} textAnchor="middle" fontSize="7" fill="#9CA3AF">{d.month}</text>
          </g>
        ))}
      </svg>
    );
  }

  function renderRevenueBars() {
    const W = 420, H = 150;
    const pad = { t: 24, r: 16, b: 26, l: 52 };
    const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
    const maxV = Math.max(...pts.map(p => p.revenue), 1);
    const colW = iW / pts.length; const barW = colW * 0.6;
    const cx    = (i: number) => pad.l + colW * i + (colW - barW) / 2;
    const cxMid = (i: number) => pad.l + colW * i + colW / 2;
    const cy    = (v: number) => pad.t + iH - (v / maxV) * iH;
    const baseY = pad.t + iH;
    const n = pts.length; const xm = (n - 1) / 2; const ym = totalRevenue / n;
    const denom = pts.reduce((s, _, i) => s + (i - xm) ** 2, 0);
    const slope = denom > 0 ? pts.reduce((s, p, i) => s + (i - xm) * (p.revenue - ym), 0) / denom : 0;
    const intercept = ym - slope * xm;
    const trendPath = pts.map((_, i) => `${i === 0 ? "M" : "L"}${cxMid(i).toFixed(1)},${cy(Math.max(0, intercept + slope * i)).toFixed(1)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={cy(maxV * t)} x2={W - pad.r} y2={cy(maxV * t)} stroke="#F3F4F6" strokeWidth="0.8" />
            <text x={pad.l - 4} y={cy(maxV * t)} textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">{fmtMoney(maxV * t)}</text>
          </g>
        ))}
        {pts.map((p, i) => (
          <g key={i}>
            <rect x={cx(i)} y={cy(p.revenue)} width={barW} height={baseY - cy(p.revenue)} rx="3" fill="#3B82F6" opacity="0.75" />
            <text x={cx(i) + barW / 2} y={cy(p.revenue) - 3} textAnchor="middle" fontSize="6.5" fill="#3B82F6" fontWeight="700">{fmtMoney(p.revenue)}</text>
            <text x={cxMid(i)} y={H - 5} textAnchor="middle" fontSize="7" fill="#9CA3AF">{p.month.replace("Month ", "M")}</text>
          </g>
        ))}
        <path d={trendPath} fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2.5" strokeLinecap="round" />
      </svg>
    );
  }

  function renderIncomeDonut() {
    const rawSlices = [
      { label: "Variable (COGS)", value: totalVariable, color: "#EF4444" },
      { label: "Fixed Costs",     value: totalFixed,    color: "#F97316" },
      { label: "Net Profit",      value: Math.max(netProfit, 0), color: "#10B981" },
    ];
    const total = rawSlices.reduce((s, i) => s + i.value, 0);
    if (!total) return <p className="text-xs text-gray-400 text-center py-8">No data</p>;
    const R = 48, CX = 66, CY = 66, SW = 15;
    const C = 2 * Math.PI * R; const GAP = 2;
    let acc = 0;
    const segs = rawSlices.filter(s => s.value > 0).map(s => {
      const arcLen = Math.max((s.value / total) * C - GAP, 0);
      const seg = { ...s, arcLen, acc };
      acc += (s.value / total) * C;
      return seg;
    });
    return (
      <div className="flex flex-col items-center gap-2">
        <svg width={CX * 2} height={CY * 2}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={SW} />
          {segs.map((seg, i) => (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth={SW}
              strokeDasharray={`${seg.arcLen} ${C - seg.arcLen}`}
              strokeDashoffset={C / 4 - seg.acc} strokeLinecap="butt" />
          ))}
          <text x={CX} y={CY - 7} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{fmtMoney(totalRevenue)}</text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize="7" fill="#9CA3AF" fontWeight="600">REVENUE</text>
        </svg>
        <div className="w-full space-y-1.5 px-1">
          {rawSlices.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-gray-600 flex-1 truncate">{s.label}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: s.color }}>{Math.round((s.value / total) * 100)}%</span>
              <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">{fmtMoney(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCashFlow() {
    const W = 420, H = 150;
    const pad = { t: 24, r: 16, b: 26, l: 52 };
    const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
    const maxAbs = Math.max(...pts.map(p => Math.abs(p.net)), 1);
    const colW = iW / pts.length; const barW = colW * 0.55;
    const cx    = (i: number) => pad.l + colW * i + (colW - barW) / 2;
    const cxMid = (i: number) => pad.l + colW * i + colW / 2;
    const midY  = pad.t + iH / 2;
    const cy    = (v: number) => midY - (v / maxAbs) * (iH / 2);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={pad.l} y1={pad.t}      x2={W - pad.r} y2={pad.t}      stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1={pad.l} y1={pad.t + iH} x2={W - pad.r} y2={pad.t + iH} stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1={pad.l} y1={midY}       x2={W - pad.r} y2={midY}       stroke="#D1D5DB" strokeWidth="1" />
        <text x={pad.l - 4} y={pad.t}      textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">{fmtMoney(maxAbs)}</text>
        <text x={pad.l - 4} y={midY}       textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">$0</text>
        <text x={pad.l - 4} y={pad.t + iH} textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">-{fmtMoney(maxAbs)}</text>
        {pts.map((p, i) => {
          const pos    = p.net >= 0;
          const barTop = pos ? cy(p.net) : midY;
          const barH   = Math.max(Math.abs(cy(p.net) - midY), 2);
          const color  = pos ? "#10B981" : "#EF4444";
          return (
            <g key={i}>
              <rect x={cx(i)} y={barTop} width={barW} height={barH} rx="2" fill={color} opacity="0.82" />
              <text x={cx(i) + barW / 2} y={pos ? barTop - 3 : barTop + barH + 8}
                textAnchor="middle" fontSize="6.5" fill={color} fontWeight="700">
                {fmtMoney(Math.abs(p.net))}
              </text>
              <text x={cxMid(i)} y={H - 5} textAnchor="middle" fontSize="7" fill="#9CA3AF">{p.month.replace("Month ", "M")}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  function renderQuarterlyBars() {
    const quarters = [
      { label: "Q1 (M1–2)", pts: pts.slice(0, 2) },
      { label: "Q2 (M3–4)", pts: pts.slice(2, 4) },
      { label: "Q3 (M5–6)", pts: pts.slice(4, 6) },
    ].filter(q => q.pts.length > 0).map(q => ({
      label: q.label,
      fixed:    q.pts.reduce((s, p) => s + p.fixed_expenses, 0),
      variable: q.pts.reduce((s, p) => s + p.variable_expenses, 0),
    }));
    const W = 420, H = 150;
    const pad = { t: 24, r: 16, b: 30, l: 52 };
    const iW = W - pad.l - pad.r; const iH = H - pad.t - pad.b;
    const maxV  = Math.max(...quarters.map(q => q.fixed + q.variable), 1);
    const colW  = iW / quarters.length; const barW = colW * 0.5;
    const cx    = (i: number) => pad.l + colW * i + (colW - barW) / 2;
    const cxMid = (i: number) => pad.l + colW * i + colW / 2;
    const cy    = (v: number) => pad.t + iH - (v / maxV) * iH;
    const baseY = pad.t + iH;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={cy(maxV * t)} x2={W - pad.r} y2={cy(maxV * t)} stroke="#F3F4F6" strokeWidth="0.8" />
            <text x={pad.l - 4} y={cy(maxV * t)} textAnchor="end" fontSize="7" fill="#9CA3AF" dominantBaseline="middle">{fmtMoney(maxV * t)}</text>
          </g>
        ))}
        {quarters.map((q, i) => {
          const fixH = (q.fixed    / maxV) * iH;
          const varH = (q.variable / maxV) * iH;
          return (
            <g key={i}>
              <rect x={cx(i)} y={cy(q.fixed + q.variable)} width={barW} height={varH} rx="3" fill="#F59E0B" opacity="0.8" />
              <rect x={cx(i)} y={baseY - fixH} width={barW} height={fixH} rx="0" fill="#EF4444" opacity="0.75" />
              <text x={cx(i) + barW / 2} y={cy(q.fixed + q.variable) - 4}
                textAnchor="middle" fontSize="7" fill="#374151" fontWeight="700">{fmtMoney(q.fixed + q.variable)}</text>
              <text x={cxMid(i)} y={H - 8} textAnchor="middle" fontSize="7.5" fill="#6B7280">{q.label}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: P&L Waterfall + Profit Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">P&amp;L Waterfall</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${netProfit >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
              {netProfit >= 0 ? `+${fmtMoney(netProfit)} net` : `${fmtMoney(netProfit)} net`}
            </span>
          </div>
          {renderPLWaterfall()}
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
            {[
              { label: "Revenue",      v: totalRevenue, c: "#10B981" },
              { label: "Gross Profit", v: grossProfit,  c: "#3B82F6" },
              { label: "Net Profit",   v: netProfit,    c: netProfit >= 0 ? "#10B981" : "#EF4444" },
            ].map(s => (
              <div key={s.label} className="flex-1">
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                <p className="text-xs font-bold tabular-nums" style={{ color: s.c }}>{fmtMoney(s.v)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Profit Margins (Monthly)</h4>
            <div className="flex gap-3">
              <span className="flex items-center gap-1 text-[10px] text-blue-600">
                <span className="w-4 h-0.5 bg-blue-500 inline-block rounded" /> Gross
              </span>
              <span className="flex items-center gap-1 text-[10px] text-violet-600">
                <svg width="16" height="4" className="inline-block"><line x1="0" y1="2" x2="16" y2="2" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
                Net
              </span>
            </div>
          </div>
          {renderMarginsChart()}
        </div>
      </div>

      {/* Row 2: Revenue Trend + Income Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Revenue Trend (6-Month)</h4>
            <span className="flex items-center gap-1 text-[10px] text-amber-600">
              <svg width="16" height="4" className="inline-block"><line x1="0" y1="2" x2="16" y2="2" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
              Trend
            </span>
          </div>
          {renderRevenueBars()}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Income Breakdown</h4>
          {renderIncomeDonut()}
        </div>
      </div>

      {/* Row 3: Monthly Cash Flow + Quarterly Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Monthly Net Cash Flow</h4>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Profit</span>
              <span className="flex items-center gap-1 text-[10px] text-red-600"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Loss</span>
            </div>
          </div>
          {renderCashFlow()}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Quarterly Cost Breakdown</h4>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] text-red-600"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Fixed</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-600"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Variable</span>
            </div>
          </div>
          {renderQuarterlyBars()}
        </div>
      </div>
    </div>
  );
}

// ── Tab Content ────────────────────────────────────────────────────────────────
function TabContent({ tab, report }: { tab: Tab; report: Report }) {
  const be = report.break_even_data;

  if (tab === "overview") {
    return (
      <div className="space-y-5">
        {/* Burn chart + Risk matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">6-Month Cash Burn Projection</h3>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">
                Financial Forecast
              </span>
            </div>
            <LineChart points={report.burn_chart} />
          </div>

          <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-6">
            <h3 className="font-semibold text-white text-sm mb-4">Risk Analysis Matrix</h3>
            <RiskMatrix items={report.risk_heatmap} />
            {report.final_recommendation && (
              <div className="mt-4 bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-400 text-sm">💡</span>
                  <span className="text-[10px] font-bold tracking-widest text-yellow-400">PRO ANALYST INSIGHTS</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-5">{report.final_recommendation}</p>
              </div>
            )}
          </div>
        </div>

        {/* 6-Month Financial Dashboard */}
        {report.burn_chart.length > 0 && (
          <FinancialDashboard points={report.burn_chart} />
        )}

        {/* Startup cost + Break-even */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <h3 className="font-semibold text-gray-900 text-sm">Startup Cost Breakdown</h3>
            </div>
            {report.startup_cost_chart.length > 0
              ? <CostBreakdownChart items={report.startup_cost_chart} />
              : <p className="text-sm text-gray-400">No data available</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <h3 className="font-semibold text-gray-900 text-sm">Break-Even Timeline</h3>
            </div>
            {be.monthly_fixed_costs > 0
              ? <BreakEvenTimeline be={be} />
              : <p className="text-sm text-gray-400">No data available</p>}
          </div>
        </div>

        {/* Score dimensions */}
        {report.score_cards.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Dimension Scores</h3>
            <ScoreDimensions cards={report.score_cards} />
          </div>
        )}

        {/* Milestones + Checklist */}
        {(report.milestones.length > 0 || report.setup_checklist.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.milestones.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 text-sm mb-4">Milestone Timeline</h3>
                <MilestoneTimeline milestones={report.milestones} businessType={report.input.businessType} businessBrief={report.input.businessBrief} />
              </div>
            )}
            {report.setup_checklist.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 text-sm mb-4">Setup Checklist</h3>
                <SetupChecklist items={report.setup_checklist} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (tab === "competitors") return <SectionCard title="Competitor Analysis" content={report.competitor_analysis} />;
  if (tab === "pricing")     return <SectionCard title="Pricing Insights" content={report.pricing_insights} />;
  if (tab === "demand")      return <SectionCard title="Demand Analysis" content={report.demand_analysis} />;

  if (tab === "risk") {
    return (
      <div className="space-y-4">
        <SectionCard title="Risk Analysis" content={report.risk_analysis} />
        {report.risk_heatmap.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Risk Heatmap</h3>
            <RiskHeatmap items={report.risk_heatmap} />
          </div>
        )}
      </div>
    );
  }

  if (tab === "startup-cost") {
    return (
      <div className="space-y-4">
        <SectionCard title="Startup Cost Estimate" content={report.startup_cost_estimate} />
        {report.startup_cost_chart.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Cost Breakdown</h3>
            <CostBreakdownChart items={report.startup_cost_chart} />
          </div>
        )}
      </div>
    );
  }

  if (tab === "opex") {
    return (
      <div className="space-y-4">
        <SectionCard title="Monthly Operating Cost" content={report.monthly_operating_cost} />
        {report.monthly_cost_chart.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Monthly Cost Breakdown</h3>
            <HBarChart items={report.monthly_cost_chart} color="#7C3AED" />
          </div>
        )}
      </div>
    );
  }

  if (tab === "burn") {
    return (
      <div className="space-y-4">
        <SectionCard title="6-Month Burn Estimate" content={report.burn_estimate_6m} />
        {report.burn_chart.length > 0 && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">Cash Flow Overview</h3>
              <LineChart points={report.burn_chart} />
            </div>
            <FinancialDashboard points={report.burn_chart} />
          </>
        )}
      </div>
    );
  }

  if (tab === "break-even") {
    return (
      <div className="space-y-4">
        <SectionCard title="Break-Even Analysis" content={report.break_even_estimate} />
        {be.monthly_fixed_costs > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Break-Even Timeline</h3>
            <BreakEvenTimeline be={be} />
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const router = useRouter();
  const { id } = router.query;

  const [report,    setReport]    = useState<Report | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>("overview");
  const [copyToast, setCopyToast] = useState(false);

  function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  }

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetch(`/api/report/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReport(d.data); else setError(d.error ?? "Failed to load."); })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [id]);

  // Derived stats
  const avgBurn = report?.burn_chart.length
    ? report.burn_chart.reduce((s, p) => s + p.expenses, 0) / report.burn_chart.length
    : 0;
  const riskLevel = !report ? null
    : report.feasibility_score >= 70 ? "Low"
    : report.feasibility_score >= 45 ? "Medium"
    : "High";
  const highRiskCount = report?.risk_heatmap.filter(r => r.probability === "High" || r.impact === "High").length ?? 0;

  const STAT_CARDS = report ? [
    {
      label: "FEASIBILITY SCORE",
      value: `${report.feasibility_score}/100`,
      sub: report.verdict,
      subColor: report.feasibility_score >= 70 ? "text-green-600" : report.feasibility_score >= 45 ? "text-amber-600" : "text-red-600",
      valueColor: "",
    },
    {
      label: "AVG BURN (EST)",
      value: `${fmtMoney(avgBurn)}/mo`,
      sub: "Monthly estimate",
      subColor: "text-gray-400",
      valueColor: "",
    },
    {
      label: "RISK LEVEL",
      value: riskLevel!,
      valueColor: riskLevel === "High" ? "text-red-600" : riskLevel === "Medium" ? "text-amber-500" : "text-green-600",
      sub: `${highRiskCount} core risk factor${highRiskCount !== 1 ? "s" : ""} identified`,
      subColor: "text-gray-400",
    },
    {
      label: "BREAK-EVEN",
      value: `${report.break_even_data.estimated_months_to_break_even} Months`,
      sub: `${report.verdict} Projection`,
      subColor: "text-gray-400",
      valueColor: "",
    },
  ] : [];

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center h-full p-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading your report…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !report) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-20">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Report Unavailable</h1>
            <p className="text-gray-500 text-sm mb-5">{error}</p>
            <Link href={ROUTES.analyze} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
              Try Again
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <SEO
        title={`${report.input.businessBrief} — Market Report`}
        description={`AI-generated market research report for ${report.input.businessBrief} in ${report.input.location}.`}
        url={`${siteConfig.url}/reports/${report.id}`}
        noIndex
      />

      <AppShell>
        <div className="p-6 space-y-5">

          {/* Title + actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                Market Overview:{" "}
                <span className="text-indigo-600">{report.input.businessBrief}</span>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Analysis complete • Updated{" "}
                {new Date(report.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Share button */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {copyToast ? "Link copied!" : "Share"}
              </button>
              {/* Download PDF */}
              <a
                href={`/api/pdf/${id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                <IconDownload /> Download PDF
              </a>
              {/* Re-analyze with same inputs */}
              {report && (
                <Link
                  href={`${ROUTES.analyze}?brief=${encodeURIComponent(report.input.businessBrief)}&location=${encodeURIComponent(report.input.location)}&type=${encodeURIComponent(report.input.businessType)}&budget=${encodeURIComponent(report.input.budget)}${report.input.zipCode ? `&zip=${encodeURIComponent(report.input.zipCode)}` : ""}`}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                  <IconRefresh /> Re-analyze
                </Link>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{card.label}</p>
                <p className={`text-2xl font-bold leading-none mb-1 ${card.valueColor || "text-gray-900"}`}>
                  {card.value}
                </p>
                <p className={`text-xs ${card.subColor}`}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="border-b border-gray-200">
            <div className="flex gap-0 overflow-x-auto -mb-px">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    tab === t.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <TabContent tab={tab} report={report} />

        </div>
      </AppShell>

      {/* Copy-to-clipboard toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Report link copied to clipboard
        </div>
      )}
    </>
  );
}
