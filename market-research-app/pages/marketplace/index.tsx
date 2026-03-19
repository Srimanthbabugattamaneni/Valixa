import { useState, useEffect, useCallback } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { MarketplaceListing } from "@/lib/marketplace-types";

const INDUSTRIES = [
  "All","Food & Beverage","Retail","Technology","Health & Wellness",
  "Education","Services","Real Estate","Manufacturing","Hospitality","Finance","Other",
];

const PRICE_RANGES = [
  { label: "Any price", min: undefined, max: undefined },
  { label: "Under $100k",   min: undefined, max: 100000 },
  { label: "$100k – $500k", min: 100000,    max: 500000 },
  { label: "$500k – $1M",   min: 500000,    max: 1000000 },
  { label: "$1M – $5M",     min: 1000000,   max: 5000000 },
  { label: "Over $5M",      min: 5000000,   max: undefined },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export default function MarketplacePage() {
  const { data: session } = useSession();
  const [listings, setListings]   = useState<MarketplaceListing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [industry, setIndustry]   = useState("All");
  const [location, setLocation]   = useState("");
  const [priceIdx, setPriceIdx]   = useState(0);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const range = PRICE_RANGES[priceIdx];
    const params = new URLSearchParams();
    if (industry !== "All") params.set("industry", industry);
    if (location)           params.set("location", location);
    if (range.min != null)  params.set("min_price", String(range.min));
    if (range.max != null)  params.set("max_price", String(range.max));

    const res  = await fetch(`/api/marketplace/listings?${params}`);
    const data = await res.json();
    if (data.success) setListings(data.data);
    setLoading(false);
  }, [industry, location, priceIdx]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  return (
    <Layout>
      <SEO title="Business Marketplace" description="Browse businesses for sale, filter by industry, location, and price. Every listing backed by real market data and a feasibility score." url={`${siteConfig.url}/marketplace`} />
      <main className="pt-24 pb-16 min-h-screen bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Business Marketplace</h1>
              <p className="text-gray-400 mt-1">Browse vetted businesses for sale with AI-powered valuations</p>
            </div>
            {session && (
              <Link
                href={ROUTES.newListing}
                className="shrink-0 bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                + List Your Business
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className="glass rounded-2xl p-5 mb-8 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full text-sm border border-white/[0.08] bg-white/[0.05] text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {INDUSTRIES.map((i) => <option key={i} style={{ background: '#09090b' }}>{i}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
              <input
                type="text"
                placeholder="City or state…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-sm border border-white/[0.08] bg-white/[0.05] text-gray-100 placeholder-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Asking Price</label>
              <select
                value={priceIdx}
                onChange={(e) => setPriceIdx(Number(e.target.value))}
                style={{ colorScheme: 'dark' }}
                className="w-full text-sm border border-white/[0.08] bg-white/[0.05] text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {PRICE_RANGES.map((r, i) => <option key={i} value={i} style={{ background: '#09090b' }}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchListings}
                className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all"
              >
                Search
              </button>
            </div>
          </div>

          {/* Listings grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-white/[0.06] rounded w-3/4 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/2 mb-6" />
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-5/6" />
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg font-medium mb-2 text-gray-300">No listings found</p>
              <p className="text-sm">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onSaveToggle={fetchListings} />
              ))}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

function ListingCard({ listing: l, onSaveToggle }: { listing: MarketplaceListing; onSaveToggle: () => void }) {
  const { data: session } = useSession();
  const [saved, setSaved] = useState(l.is_saved ?? false);
  const [saving, setSaving] = useState(false);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    await fetch(`/api/marketplace/listings/${l.id}?action=save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: !saved }),
    });
    setSaved(!saved);
    setSaving(false);
    onSaveToggle();
  }

  const riskColor = l.ai_valuation
    ? l.ai_valuation.risk_score > 66 ? "text-red-400 bg-red-500/10 border border-red-500/20"
    : l.ai_valuation.risk_score > 33 ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
    : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
    : "";

  return (
    <Link href={ROUTES.listing(l.id)} className="group block glass glass-hover rounded-2xl card-hover transition-all duration-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">{l.industry}</span>
          {session && (
            <button
              onClick={toggleSave}
              disabled={saving}
              className={`text-lg transition-colors ${saved ? "text-violet-400" : "text-gray-600 hover:text-violet-400"}`}
              title={saved ? "Unsave" : "Save listing"}
            >
              {saved ? "★" : "☆"}
            </button>
          )}
        </div>

        <h3 className="font-bold text-white text-lg mb-1 group-hover:text-violet-300 transition-colors line-clamp-1">
          {l.business_name}
        </h3>
        <p className="text-sm text-gray-500 mb-4">📍 {l.location} · {l.years_in_operation} yrs</p>

        <p className="text-sm text-gray-400 line-clamp-2 mb-4">{l.description}</p>

        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <div>
            <p className="text-xs text-gray-500">Asking Price</p>
            <p className="text-xl font-bold text-white">{fmt(l.asking_price)}</p>
          </div>
          {l.ai_valuation && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${riskColor}`}>
              Risk {l.ai_valuation.risk_score}/100
            </span>
          )}
          {!l.ai_valuation && (
            <span className="text-xs text-gray-500 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-full">No valuation yet</span>
          )}
        </div>

        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span>{l.employees} employees</span>
          <span>·</span>
          <span>Rev: {l.revenue_range}</span>
          {l.profit_margin && <><span>·</span><span>{l.profit_margin}% margin</span></>}
        </div>
      </div>
    </Link>
  );
}
