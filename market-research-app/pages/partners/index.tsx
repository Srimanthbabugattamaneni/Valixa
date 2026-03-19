import { useState, useEffect, useCallback } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { PartnerProfile, PartnerRole } from "@/lib/marketplace-types";

const ROLES: PartnerRole[] = ["technical","operations","investor","marketing","sales","other"];

const ROLE_COLORS: Record<PartnerRole, string> = {
  technical:  "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  operations: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  investor:   "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  marketing:  "bg-pink-500/15 text-pink-400 border border-pink-500/20",
  sales:      "bg-orange-500/15 text-orange-400 border border-orange-500/20",
  other:      "bg-white/[0.05] text-gray-400 border border-white/[0.08]",
};

const CAPITAL_LABELS: Record<string, string> = {
  "under-10k":  "< $10k",
  "10k-50k":    "$10k–$50k",
  "50k-250k":   "$50k–$250k",
  "250k-1m":    "$250k–$1M",
  "over-1m":    "$1M+",
};

export default function PartnersPage() {
  const { data: session } = useSession();
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [role, setRole]         = useState<string>("all");
  const [location, setLocation] = useState("");
  const [matchMode, setMatchMode] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (role !== "all") params.set("role", role);
    if (location)       params.set("location", location);
    if (matchMode && session) params.set("match", "true");

    const res  = await fetch(`/api/partners?${params}`);
    const data = await res.json();
    if (data.success) setPartners(data.data);
    setLoading(false);
  }, [role, location, matchMode, session]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  return (
    <Layout>
      <SEO title="Find Co-Founders & Partners" description="Find co-founders, investors, operators, and marketers for your next venture. Filter by role, location, and available capital." url={`${siteConfig.url}/partners`} />
      <main className="pt-24 pb-16 min-h-screen bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Find a Business Partner</h1>
              <p className="text-gray-400 mt-1">Connect with co-founders, investors, and operators</p>
            </div>
            {session && (
              <Link
                href={ROUTES.partnerProfile}
                className="shrink-0 bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                {session ? "Edit My Profile" : "Create Profile"}
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className="glass rounded-2xl p-5 mb-8 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full text-sm border border-white/[0.08] bg-white/[0.05] text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                <option value="all" style={{ background: '#09090b' }}>All Roles</option>
                {ROLES.map((r) => <option key={r} value={r} style={{ background: '#09090b' }} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="City or state…"
                className="w-full text-sm border border-white/[0.08] bg-white/[0.05] text-gray-100 placeholder-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
            </div>
            {session && (
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer pb-1">
                <input type="checkbox" checked={matchMode} onChange={(e) => setMatchMode(e.target.checked)}
                  className="rounded accent-violet-500" />
                AI match to my profile
              </label>
            )}
            <button onClick={fetchPartners}
              className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all">
              Search
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse h-52" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg font-medium mb-2 text-gray-300">No partners found</p>
              <p className="text-sm mb-6">Adjust your filters or create a profile to be discoverable.</p>
              {session && (
                <Link href={ROUTES.partnerProfile} className="text-violet-400 font-medium hover:text-violet-300 hover:underline">
                  Create your partner profile →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((p) => <PartnerCard key={p.id} profile={p} />)}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

function PartnerCard({ profile: p }: { profile: PartnerProfile }) {
  return (
    <Link href={ROUTES.partner(p.id)}
      className="group block glass glass-hover rounded-2xl card-hover transition-all duration-200 p-6">

      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_COLORS[p.role as PartnerRole]}`}>
          {p.role}
        </span>
        {p.compatibility_score !== undefined && (
          <span className="text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
            {p.compatibility_score}% match
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-sm shrink-0">
          {p.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors">{p.display_name}</h3>
          {p.location && <p className="text-xs text-gray-500">📍 {p.location}</p>}
        </div>
      </div>

      {p.bio && <p className="text-sm text-gray-400 line-clamp-2 mb-4">{p.bio}</p>}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {(p.skills ?? []).slice(0, 4).map((s) => (
          <span key={s} className="text-xs bg-white/[0.05] border border-white/[0.08] text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
        ))}
        {(p.skills?.length ?? 0) > 4 && (
          <span className="text-xs text-gray-500">+{(p.skills?.length ?? 0) - 4}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05] text-xs text-gray-500">
        {p.capital_available && <span>Capital: {CAPITAL_LABELS[p.capital_available] ?? p.capital_available}</span>}
        {p.preferred_stage && <span className="capitalize">{p.preferred_stage} stage</span>}
      </div>

      {p.match_reasons && p.match_reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-violet-500/10">
          <p className="text-xs text-violet-400 font-medium">{p.match_reasons[0]}</p>
        </div>
      )}
    </Link>
  );
}