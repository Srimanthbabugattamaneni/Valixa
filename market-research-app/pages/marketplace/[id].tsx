import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { MarketplaceListing, AiValuation, ListingStatus } from "@/lib/marketplace-types";
import type { ApiResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

const STAGE_LABELS: Record<string, string> = {
  inquiry: "Inquiry Sent", nda_signed: "NDA Signed", due_diligence: "Due Diligence",
  offer_made: "Offer Made", offer_accepted: "Offer Accepted", closed: "Closed", withdrawn: "Withdrawn",
};

export default function ListingDetailPage() {
  const router  = useRouter();
  const { id }  = router.query as { id: string };
  const { data: session } = useSession();
  const userId  = (session?.user as { id?: string })?.id;

  const { data, mutate } = useSWR<ApiResponse<MarketplaceListing>>(
    id ? `/api/marketplace/listings/${id}` : null, fetcher
  );

  const [valuating,  setValuating]  = useState(false);
  const [messaging,  setMessaging]  = useState(false);
  const [msgSent,    setMsgSent]    = useState(false);
  const [dealSent,   setDealSent]   = useState(false);
  const [msgText,    setMsgText]    = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [editMode,   setEditMode]   = useState(router.query.edit === "1");
  const [saving,     setSaving]     = useState(false);
  const [editForm,   setEditForm]   = useState<Partial<MarketplaceListing>>({});
  const [editError,  setEditError]  = useState<string | null>(null);

  const listing = data?.success ? data.data : null;
  const isOwner = listing && userId === listing.seller_id;

  async function generateValuation() {
    if (!listing) return;
    setValuating(true);
    const res  = await fetch(`/api/marketplace/listings/${id}?action=valuate`, { method: "POST" });
    const json = await res.json();
    if (json.success) mutate();
    setValuating(false);
  }

  async function contactSeller() {
    const res  = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id }),
    });
    const json = await res.json();
    if (json.success) setMessaging(true);
  }

  async function sendMessage() {
    if (!msgText.trim()) return;
    setSendingMsg(true);
    // Create thread first if needed (idempotent), then send message
    const threadRes = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id }),
    });
    const threadJson = await threadRes.json();
    if (threadJson.success) {
      await fetch(`/api/messages/${threadJson.data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msgText }),
      });
      setMsgText("");
      setMessaging(false);
      setMsgSent(true);
    }
    setSendingMsg(false);
  }

  async function saveEdit() {
    if (!listing) return;
    setSaving(true);
    setEditError(null);
    const res  = await fetch(`/api/marketplace/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const json = await res.json();
    if (json.success) {
      await mutate();
      setEditMode(false);
      router.replace(ROUTES.listing(id), undefined, { shallow: true });
    } else {
      setEditError(json.error ?? "Failed to save.");
    }
    setSaving(false);
  }

  async function startDeal() {
    const res  = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id }),
    });
    const json = await res.json();
    if (json.success) setDealSent(true);
  }

  if (!data) return (
    <Layout>
      <main className="pt-32 flex justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    </Layout>
  );
  if (!listing) return (
    <Layout>
      <main className="pt-32 text-center text-gray-500">Listing not found.</main>
    </Layout>
  );

  const val = listing.ai_valuation;

  return (
    <Layout>
      <Head><title>{`${listing.business_name} — ${siteConfig.name}`}</title></Head>
      <main className="pt-24 pb-16 min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">

          {/* Breadcrumb */}
          <nav className="text-sm text-gray-400 mb-6">
            <Link href={ROUTES.marketplace} className="hover:text-indigo-600">Marketplace</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">{listing.business_name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">

              {/* Header card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {listing.industry}
                  </span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    listing.status === "active" ? "bg-green-50 text-green-700" :
                    listing.status === "under_offer" ? "bg-amber-50 text-amber-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>{listing.status.replace("_", " ").toUpperCase()}</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{listing.business_name}</h1>
                <p className="text-gray-500 mb-6">📍 {listing.location} · {listing.years_in_operation} years in operation</p>
                <p className="text-gray-700 leading-relaxed">{listing.description}</p>
              </div>

              {/* Details grid */}
              <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-5">Business Details</h2>
                <div className="grid grid-cols-2 gap-y-5 gap-x-8">
                  {[
                    ["Annual Revenue",   listing.revenue_range],
                    ["Profit Margin",    listing.profit_margin ? `${listing.profit_margin}%` : "—"],
                    ["Employees",        listing.employees],
                    ["Years Operating",  listing.years_in_operation],
                    ["Assets Included",  listing.assets_included ?? "—"],
                    ["Reason for Sale",  listing.reason_for_selling ?? "—"],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Valuation */}
              <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">AI Valuation</h2>
                  {isOwner && !val && (
                    <button
                      onClick={generateValuation}
                      disabled={valuating}
                      className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {valuating ? "Analysing…" : "Generate Valuation"}
                    </button>
                  )}
                </div>

                {!val ? (
                  <p className="text-gray-400 text-sm">No AI valuation generated yet.{isOwner ? " Click the button above to generate one." : ""}</p>
                ) : (
                  <ValuationDisplay val={val} askingPrice={listing.asking_price} />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">

              {/* Price card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-xs text-gray-400 mb-1">Asking Price</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{fmt(listing.asking_price)}</p>
                {val && (
                  <p className="text-sm text-gray-500">
                    AI estimate: {fmt(val.valuation_range.low)} – {fmt(val.valuation_range.high)}
                  </p>
                )}
              </div>

              {/* Actions */}
              {!isOwner && session && listing.status === "active" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
                  {msgSent ? (
                    <div className="text-center py-2 space-y-2">
                      <p className="text-sm font-semibold text-emerald-600">✓ Message sent!</p>
                      <Link href={ROUTES.messages} className="block text-xs text-indigo-600 hover:underline">
                        View in Messages →
                      </Link>
                    </div>
                  ) : !messaging ? (
                    <button
                      onClick={contactSeller}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      Contact Seller
                    </button>
                  ) : (
                    <div>
                      <textarea
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        rows={4}
                        placeholder="Introduce yourself and ask any questions…"
                        className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-2"
                      />
                      <div className="flex gap-2">
                        <button onClick={sendMessage} disabled={sendingMsg || !msgText.trim()}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                          {sendingMsg ? "Sending…" : "Send"}
                        </button>
                        <button onClick={() => setMessaging(false)}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!dealSent ? (
                    <button
                      onClick={startDeal}
                      className="w-full border border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      Express Interest
                    </button>
                  ) : (
                    <div className="text-center text-sm text-green-600 font-medium py-2.5">
                      ✓ Interest recorded — check your Dashboard
                    </div>
                  )}
                </div>
              )}

              {isOwner && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
                  <button
                    onClick={() => { setEditForm({ ...listing }); setEditMode(true); }}
                    className="block w-full text-center border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Edit Listing
                  </button>
                  <Link
                    href={ROUTES.deals}
                    className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    View Deals
                  </Link>
                </div>
              )}

              {!session && (
                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-6 text-center">
                  <p className="text-sm text-indigo-800 font-medium mb-3">Sign in to contact the seller</p>
                  <Link href={ROUTES.login} className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                    Sign In
                  </Link>
                </div>
              )}

              {/* Meta */}
              <div className="text-xs text-gray-400 space-y-1 px-1">
                <p>{listing.views} views</p>
                <p>Listed {new Date(listing.created_at).toLocaleDateString()}</p>
                {listing.seller_name && <p>Seller: {listing.seller_name}</p>}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Edit listing modal ── */}
      {editMode && isOwner && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Edit Listing</h2>
              <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-700">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
              )}

              {[
                { key: "business_name", label: "Business Name", type: "text" },
                { key: "industry",      label: "Industry",       type: "text" },
                { key: "location",      label: "Location",       type: "text" },
                { key: "asking_price",  label: "Asking Price ($)", type: "number" },
                { key: "profit_margin", label: "Profit Margin (%)", type: "number" },
                { key: "employees",     label: "Employees",      type: "number" },
                { key: "years_in_operation", label: "Years in Operation", type: "number" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editForm as Record<string, unknown>)[key] as string ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea
                  rows={4}
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assets Included</label>
                <input
                  type="text"
                  value={editForm.assets_included ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, assets_included: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for Selling</label>
                <input
                  type="text"
                  value={editForm.reason_for_selling ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, reason_for_selling: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  value={editForm.status ?? listing?.status ?? "active"}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ListingStatus }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {(["draft","active","under_offer","sold","withdrawn"] as ListingStatus[]).map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ValuationDisplay({ val, askingPrice }: { val: AiValuation; askingPrice: number }) {
  const riskColor = val.risk_score > 66 ? "text-red-600 bg-red-50"
    : val.risk_score > 33 ? "text-amber-600 bg-amber-50"
    : "text-green-600 bg-green-50";

  const fairness = askingPrice <= val.valuation_range.high && askingPrice >= val.valuation_range.low
    ? { label: "Fairly priced", cls: "text-green-600 bg-green-50" }
    : askingPrice > val.valuation_range.high
    ? { label: "Above estimate", cls: "text-amber-600 bg-amber-50" }
    : { label: "Below estimate", cls: "text-blue-600 bg-blue-50" };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Estimated Value</p>
          <p className="text-lg font-bold text-gray-900">{`$${(val.estimated_value / 1000).toFixed(0)}k`}</p>
        </div>
        <div className={`rounded-xl p-4 ${riskColor}`}>
          <p className="text-xs mb-1 opacity-70">Risk Score</p>
          <p className="text-lg font-bold">{val.risk_score}/100</p>
        </div>
        <div className={`rounded-xl p-4 ${fairness.cls}`}>
          <p className="text-xs mb-1 opacity-70">Price Assessment</p>
          <p className="text-sm font-bold">{fairness.label}</p>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Confidence:</span>
        <span className={`font-semibold ${
          val.confidence === "High" ? "text-green-600" :
          val.confidence === "Medium" ? "text-amber-600" : "text-red-600"
        }`}>{val.confidence}</span>
      </div>

      {/* Value drivers & risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Value Drivers</p>
          <ul className="space-y-1.5">
            {val.key_value_drivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-500 mt-0.5">✓</span>{d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Risk Factors</p>
          <ul className="space-y-1.5">
            {val.risk_factors.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-red-400 mt-0.5">!</span>{r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Recommendation</p>
        <p className="text-sm text-gray-700">{val.recommendation}</p>
      </div>

      <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{val.comparable_sales}</p>
    </div>
  );
}
