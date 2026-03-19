import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { Deal, DealStage } from "@/lib/marketplace-types";
import type { ApiResponse } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────────
const STAGES: DealStage[] = [
  "inquiry", "nda_signed", "due_diligence", "offer_made",
  "offer_accepted", "closed", "withdrawn",
];

const STAGE_LABEL: Record<DealStage, string> = {
  inquiry:        "Inquiry",
  nda_signed:     "NDA Signed",
  due_diligence:  "Due Diligence",
  offer_made:     "Offer Made",
  offer_accepted: "Offer Accepted",
  closed:         "Closed",
  withdrawn:      "Withdrawn",
};

const STAGE_COLOR: Record<DealStage, string> = {
  inquiry:        "bg-white/[0.05] text-gray-400 border border-white/[0.08]",
  nda_signed:     "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  due_diligence:  "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  offer_made:     "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  offer_accepted: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  closed:         "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  withdrawn:      "bg-red-500/15 text-red-400 border border-red-500/20",
};

// Stage progression order (for pipeline bar)
const ACTIVE_STAGES: DealStage[] = [
  "inquiry", "nda_signed", "due_diligence", "offer_made", "offer_accepted", "closed",
];

function stagePct(stage: DealStage): number {
  const idx = ACTIVE_STAGES.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / ACTIVE_STAGES.length) * 100);
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ── Deal Card ──────────────────────────────────────────────────────────────────
function DealCard({
  deal, userId, onStageChange,
}: {
  deal: Deal & { listing_name?: string; buyer_name?: string; seller_name?: string };
  userId: string;
  onStageChange: (id: string, stage: DealStage) => void;
}) {
  const isBuyer  = deal.buyer_id  === userId;
  const role     = isBuyer ? "Buyer" : "Seller";
  const pct      = stagePct(deal.stage);
  const isActive = deal.stage !== "withdrawn" && deal.stage !== "closed";

  // Next valid stage transitions
  const nextStages = STAGES.filter((s) => {
    const cur = STAGES.indexOf(deal.stage);
    const tgt = STAGES.indexOf(s);
    return tgt > cur && s !== "withdrawn";
  }).slice(0, 2);

  return (
    <div className="glass glass-hover rounded-2xl p-5 space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={ROUTES.listing(deal.listing_id)}
            className="text-sm font-semibold text-gray-200 hover:text-violet-300 transition-colors line-clamp-1"
          >
            {deal.listing_name ?? "Business Listing"}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">
            {isBuyer
              ? `Seller: ${deal.seller_name ?? "—"}`
              : `Buyer: ${deal.buyer_name ?? "—"}`}
            {" · "}
            <span className="capitalize">{role}</span>
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STAGE_COLOR[deal.stage]}`}>
          {STAGE_LABEL[deal.stage]}
        </span>
      </div>

      {/* Pipeline progress bar */}
      {isActive && (
        <div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-medium text-gray-500 mt-1">
            <span>Inquiry</span>
            <span>{pct}%</span>
            <span>Closed</span>
          </div>
        </div>
      )}

      {/* Offer amount */}
      {deal.offer_amount && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">Offer Amount</span>
          <span className="text-sm font-bold text-white">{fmt(deal.offer_amount)}</span>
        </div>
      )}

      {/* Notes */}
      {deal.notes && (
        <p className="text-xs text-gray-500 italic leading-relaxed line-clamp-2">{deal.notes}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isActive && nextStages.map((s) => (
          <button
            key={s}
            onClick={() => onStageChange(deal.id, s)}
            className="text-[11px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            → {STAGE_LABEL[s]}
          </button>
        ))}
        {isActive && (
          <button
            onClick={() => onStageChange(deal.id, "withdrawn")}
            className="text-[11px] font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors ml-auto"
          >
            Withdraw
          </button>
        )}
        <Link
          href={ROUTES.listing(deal.listing_id)}
          className="text-[11px] font-semibold text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors"
        >
          View Listing →
        </Link>
      </div>

      {/* Timestamp */}
      <p className="text-[10px] text-gray-600">
        Updated {new Date(deal.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DealsPage() {
  const router  = useRouter();
  const { data: session, status } = useSession();
  const userId  = (session?.user as { id?: string })?.id ?? "";

  const [deals,   setDeals]   = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<"all" | "buying" | "selling">("all");

  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/deals")
      .then((r) => r.json() as Promise<ApiResponse<Deal[]>>)
      .then((d) => {
        if (d.success) setDeals(d.data);
        else setError((d as { error: string }).error ?? "Failed to load deals.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [status]);

  async function updateStage(id: string, stage: DealStage) {
    const res  = await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const json = await res.json() as ApiResponse<Deal>;
    if (json.success) {
      setDeals((prev) => prev.map((d) => (d.id === id ? json.data : d)));
    }
  }

  const filtered = deals.filter((d) => {
    if (filter === "buying")  return d.buyer_id  === userId;
    if (filter === "selling") return d.seller_id === userId;
    return true;
  });

  const activeCount   = deals.filter((d) => d.stage !== "closed" && d.stage !== "withdrawn").length;
  const closedCount   = deals.filter((d) => d.stage === "closed").length;
  const buyingCount   = deals.filter((d) => d.buyer_id  === userId).length;
  const sellingCount  = deals.filter((d) => d.seller_id === userId).length;

  return (
    <>
      <Head><title>{`Deals — ${siteConfig.name}`}</title></Head>
      <AppShell>
        <div className="p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {deals.length === 0 ? "No deals yet" : `${activeCount} active · ${closedCount} closed`}
              </p>
            </div>
            <Link
              href={ROUTES.marketplace}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0"
            >
              Browse Marketplace
            </Link>
          </div>

          {/* Stats */}
          {deals.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Deals",  value: deals.length,  color: "text-white" },
                { label: "Active",       value: activeCount,   color: "text-violet-400" },
                { label: "As Buyer",     value: buyingCount,   color: "text-blue-400" },
                { label: "As Seller",    value: sellingCount,  color: "text-emerald-400" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter tabs */}
          {deals.length > 0 && (
            <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 w-fit">
              {(["all", "buying", "selling"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filter === f
                      ? "bg-white/[0.08] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f === "all" ? "All Deals" : f === "buying" ? "I'm Buying" : "I'm Selling"}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-44 glass rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="glass rounded-2xl p-16 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">No deals yet</h2>
              <p className="text-sm text-gray-500 max-w-xs mb-5">
                Browse the marketplace and express interest in a listing to start a deal.
              </p>
              <Link
                href={ROUTES.marketplace}
                className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                Browse Marketplace
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <p className="text-sm text-gray-500">No deals in this category.</p>
              <button onClick={() => setFilter("all")} className="mt-2 text-sm text-violet-400 hover:text-violet-300 hover:underline">
                Show all
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  userId={userId}
                  onStageChange={updateStage}
                />
              ))}
            </div>
          )}

        </div>
      </AppShell>
    </>
  );
}