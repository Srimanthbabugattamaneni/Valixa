import { useState, useEffect, useRef } from "react";
import SEO from "@/components/SEO";
import { useRouter } from "next/router";
import Layout from "@/components/layout/Layout";
import { ROUTES, API_ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { AnalyzeFormData, BudgetRange } from "@/lib/types";

const businessTypes = [
  "Retail & E-Commerce",
  "Food & Beverage",
  "Health & Wellness",
  "Technology & SaaS",
  "Education & Coaching",
  "Professional Services",
  "Real Estate",
  "Manufacturing",
  "Hospitality & Travel",
  "Other",
];

const budgetRanges: { label: string; value: BudgetRange }[] = [
  { label: "Under $10,000", value: "under-10k" },
  { label: "$10,000 – $50,000", value: "10k-50k" },
  { label: "$50,000 – $250,000", value: "50k-250k" },
  { label: "$250,000 – $1M", value: "250k-1m" },
  { label: "Over $1M", value: "over-1m" },
];

// ── Progress overlay steps ─────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { label: "Gathering market data",          sub: "Querying Google Places, Yelp & Census APIs…" },
  { label: "Analyzing competitor landscape", sub: "Mapping nearby rivals, ratings & price tiers…" },
  { label: "Running AI analysis",            sub: "Claude is generating your 10-section report…" },
  { label: "Building your report",           sub: "Assembling financials, charts & action plan…" },
];
// Cumulative ms at which each step becomes active
const STEP_TIMES = [0, 18_000, 40_000, 72_000];

// ── Guided brief prompts per business type ─────────────────────────────────────
const BRIEF_HINTS: Record<string, string> = {
  "Food & Beverage":         "e.g. A fast-casual taco restaurant targeting downtown lunch crowds, 40 seats, dine-in + delivery. Weekend brunch focus.",
  "Retail & E-Commerce":     "e.g. A curated vintage clothing store in a walkable arts district, primarily Gen-Z shoppers, with an online shop component.",
  "Health & Wellness":       "e.g. A boutique yoga & pilates studio targeting professionals aged 25–45, offering class packs and monthly memberships.",
  "Technology & SaaS":       "e.g. A project-management SaaS for freelance designers, subscription-based, remote-first with a freemium onboarding model.",
  "Education & Coaching":    "e.g. An online coding bootcamp for career-changers, cohort-based, 12-week program, B2C and B2B corporate licensing.",
  "Professional Services":   "e.g. A boutique digital-marketing agency serving local SMBs, SEO + paid ads focus, retainer pricing model.",
  "Real Estate":             "e.g. A short-term rental management company for Airbnb hosts, 10–50 unit portfolio, charging 15–20% management fee.",
  "Manufacturing":           "e.g. A small-batch artisan candle manufacturer selling direct-to-consumer and wholesale to gift shops.",
  "Hospitality & Travel":    "e.g. A boutique glamping retreat outside Austin, 12 safari tents, weekend getaway market, peak season Apr–Oct.",
};

const reportIncludes = [
  "Competitor density & analysis",
  "Local demographic insights",
  "Pricing benchmarks",
  "Market size estimate",
  "Financial projections",
  "Business viability score",
];

// ── ZIP resolution (zippopotam.us — free, no key, CORS open) ──────────────────
async function resolveZip(zip: string): Promise<{ city: string; state: string; stateAbbr: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      city:      place["place name"],
      state:     place["state"],
      stateAbbr: place["state abbreviation"],
    };
  } catch {
    return null;
  }
}

const emptyForm: AnalyzeFormData = {
  businessBrief: "",
  zipCode: "",
  location: "",
  businessType: "",
  budget: "" as BudgetRange,
};

export default function Analyze() {
  const router = useRouter();
  const [form, setForm] = useState<AnalyzeFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [zipResolving, setZipResolving] = useState(false);
  const [zipResolved, setZipResolved] = useState<{ city: string; state: string } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const zipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimize brief state
  const [optimizing, setOptimizing] = useState(false);
  const [originalBrief, setOriginalBrief] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  async function handleOptimize() {
    if (!form.businessBrief.trim() || optimizing) return;
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await fetch("/api/optimize-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: form.businessBrief, businessType: form.businessType }),
      });
      const json = await res.json() as { success: boolean; data?: { optimized: string }; error?: string };
      if (json.success && json.data?.optimized) {
        setOriginalBrief(form.businessBrief);
        setForm(prev => ({ ...prev, businessBrief: json.data!.optimized }));
      } else {
        setOptimizeError(json.error ?? "Optimization failed.");
      }
    } catch {
      setOptimizeError("Network error. Please try again.");
    } finally {
      setOptimizing(false);
    }
  }

  // Pre-fill form from query params (Re-analyze button)
  useEffect(() => {
    const { brief, location, type, budget, zip } = router.query;
    if (brief || location || type || budget || zip) {
      setForm(prev => ({
        ...prev,
        businessBrief: typeof brief    === "string" ? brief    : prev.businessBrief,
        zipCode:       typeof zip      === "string" ? zip      : prev.zipCode,
        location:      typeof location === "string" ? location : prev.location,
        businessType:  typeof type     === "string" ? type     : prev.businessType,
        budget:        typeof budget   === "string" ? budget as BudgetRange : prev.budget,
      }));
      // If zip pre-filled, resolve it
      if (typeof zip === "string" && /^\d{5}$/.test(zip)) {
        resolveZip(zip).then(info => {
          if (info) setZipResolved({ city: info.city, state: info.stateAbbr });
        });
      }
    }
  }, [router.query]);

  // Live ZIP resolution — debounced 400ms after user stops typing
  useEffect(() => {
    const zip = form.zipCode;
    if (zipTimerRef.current) clearTimeout(zipTimerRef.current);
    if (zip.length !== 5) {
      setZipResolved(null);
      setZipError(null);
      return;
    }
    setZipResolving(true);
    setZipError(null);
    zipTimerRef.current = setTimeout(async () => {
      const info = await resolveZip(zip);
      setZipResolving(false);
      if (info) {
        setZipResolved({ city: info.city, state: info.stateAbbr });
        setZipError(null);
        setForm(prev => ({ ...prev, location: `${info.city}, ${info.stateAbbr}` }));
      } else {
        setZipResolved(null);
        setZipError("ZIP code not found. Please check and try again.");
      }
    }, 400);
    return () => { if (zipTimerRef.current) clearTimeout(zipTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zipCode]);

  // Advance progress steps on a realistic timeline
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

  const isComplete =
    form.businessBrief.trim().length >= 3 &&
    /^\d{5}$/.test(form.zipCode) &&
    zipResolved !== null &&
    form.businessType &&
    form.budget;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isComplete) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTES.analyze, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessBrief: form.businessBrief,
          zipCode:       form.zipCode,
          location:      form.location,
          businessType:  form.businessType,
          budget:        form.budget,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Something went wrong");
      }

      router.push(ROUTES.report(data.data.requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout showFooter={false}>
      <SEO
        title="Analyze Your Business Idea"
        description="Describe your business concept, location, and budget. Valixa's AI generates a full market research report with competitor analysis, demographics, and financial projections."
        url={`${siteConfig.url}/analyze`}
        noIndex
      />

      {/* ── Loading overlay ─────────────────────────────────────────────── */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-[#09090b] flex items-center justify-center px-6">
          <div className="max-w-md w-full">
            {/* Branding */}
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/20">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Generating your report</h2>
              <p className="text-sm text-gray-400">This takes 60–90 seconds. Please keep this tab open.</p>
            </div>

            {/* Steps */}
            <div className="space-y-5 mb-10">
              {PROGRESS_STEPS.map((step, i) => {
                const done   = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={i} className="flex items-center gap-4">
                    {/* Status icon */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                      done   ? "bg-emerald-500/15 border border-emerald-500/20"  :
                      active ? "bg-violet-500/15 border border-violet-500/20" : "bg-white/[0.04] border border-white/[0.08]"
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
                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold transition-colors duration-300 ${
                        done ? "text-emerald-400" : active ? "text-violet-300" : "text-gray-600"
                      }`}>{step.label}</p>
                      {active && (
                        <p className="text-xs text-violet-400 mt-0.5 animate-pulse truncate">{step.sub}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${((currentStep + 1) / PROGRESS_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Step {currentStep + 1} of {PROGRESS_STEPS.length}
            </p>
          </div>
        </div>
      )}

      <main className="pt-28 pb-24 px-6 bg-[#09090b] min-h-screen">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 border border-violet-500/20">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              Step 1 of 1 — Tell us about your idea
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              Analyze your business idea
            </h1>
            <p className="text-gray-400 text-lg">
              Fill in the details below and we'll generate a full market research
              report tailored to your concept.
            </p>
          </div>

          {/* Form card */}
          <form
            onSubmit={handleSubmit}
            className="glass rounded-2xl p-8 space-y-7"
          >
            {/* Business Brief */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="businessBrief" className="block text-sm font-semibold text-gray-300">
                  Brief About the Business
                </label>
                <button
                  type="button"
                  onClick={handleOptimize}
                  disabled={!form.businessBrief.trim() || optimizing}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    optimizing
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-400 cursor-wait"
                      : form.businessBrief.trim()
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/40"
                      : "border-white/[0.08] bg-white/[0.03] text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {optimizing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      Optimizing…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Optimize with AI
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="businessBrief"
                name="businessBrief"
                rows={4}
                value={form.businessBrief}
                onChange={e => {
                  handleChange(e);
                  // Clear original if user manually edits after optimization
                  if (originalBrief) setOriginalBrief(null);
                }}
                placeholder="e.g. A specialty coffee shop focused on single-origin brews and a cozy community workspace, targeting remote workers and coffee enthusiasts in the downtown area."
                className={`w-full px-4 py-3 rounded-xl border bg-white/[0.05] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm resize-none ${
                  originalBrief ? "border-violet-500/30 bg-violet-500/[0.07]" : "border-white/[0.08]"
                }`}
              />
              {/* Optimized banner */}
              {originalBrief && (
                <div className="mt-2 flex items-start justify-between gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-violet-300">
                    <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    <span className="font-semibold">AI-optimized</span> — your brief has been enhanced for better reporting quality.
                  </div>
                  <button
                    type="button"
                    onClick={() => { setForm(prev => ({ ...prev, businessBrief: originalBrief })); setOriginalBrief(null); }}
                    className="text-[11px] text-violet-400 hover:text-violet-300 font-medium whitespace-nowrap shrink-0"
                  >
                    ↩ Revert
                  </button>
                </div>
              )}
              {/* Optimize error */}
              {optimizeError && (
                <p className="mt-1.5 text-xs text-red-400">{optimizeError}</p>
              )}
              {!originalBrief && !optimizeError && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Describe your business idea, target customers, and what makes it unique.{" "}
                  {form.businessBrief.trim() && <span className="text-violet-400 font-medium">Use "Optimize with AI" to enhance it.</span>}
                </p>
              )}
            </div>

            {/* ZIP Code */}
            <div>
              <label
                htmlFor="zipCode"
                className="block text-sm font-semibold text-gray-300 mb-2"
              >
                Target ZIP Code <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">📍</span>
                <input
                  id="zipCode"
                  name="zipCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={form.zipCode}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setForm(prev => ({ ...prev, zipCode: v }));
                  }}
                  placeholder="e.g. 78701"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-white/[0.05] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm ${
                    zipError ? "border-red-500/40 bg-red-500/[0.05]" : "border-white/[0.08]"
                  }`}
                />
                {/* Status indicator */}
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  {zipResolving && (
                    <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {zipResolved && !zipResolving && (
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </div>
              {/* Resolved city display */}
              {zipResolved && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {zipResolved.city}, {zipResolved.state}
                  <span className="text-emerald-500/70 ml-1">— searching within 1 mile of this ZIP</span>
                </div>
              )}
              {zipError && (
                <p className="mt-1.5 text-xs text-red-400">{zipError}</p>
              )}
              {!zipResolved && !zipError && !zipResolving && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Enter your 5-digit US ZIP code. We'll search competitors within 1 mile.
                </p>
              )}
            </div>

            {/* Business Type */}
            <div>
              <label
                htmlFor="businessType"
                className="block text-sm font-semibold text-gray-300 mb-2"
              >
                Business Type
              </label>
              <div className="relative">
                <select
                  id="businessType"
                  name="businessType"
                  value={form.businessType}
                  onChange={handleChange}
                  style={{ colorScheme: 'dark' }}
                  className="w-full appearance-none px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.05] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition text-sm"
                >
                  <option value="" disabled style={{ background: '#09090b' }}>
                    Select an industry…
                  </option>
                  {businessTypes.map((type) => (
                    <option key={type} value={type} style={{ background: '#09090b' }}>
                      {type}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  ▼
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                The industry or sector your business falls under.
              </p>
              {form.businessType && BRIEF_HINTS[form.businessType] && (
                <div className="mt-2 flex items-start gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2.5">
                  <span className="text-violet-400 text-xs mt-0.5 shrink-0">💡</span>
                  <p className="text-xs text-violet-300 leading-relaxed">
                    <span className="font-semibold">Example brief: </span>
                    {BRIEF_HINTS[form.businessType]}
                  </p>
                </div>
              )}
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">
                Estimated Budget
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {budgetRanges.map((range) => (
                  <label
                    key={range.value}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm ${
                      form.budget === range.value
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-300 font-medium"
                        : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-violet-500/20 hover:bg-violet-500/[0.05]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={range.value}
                      checked={form.budget === range.value}
                      onChange={handleChange}
                      className="accent-violet-500"
                    />
                    {range.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Your available startup or investment budget.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isComplete || loading}
                className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                  isComplete && !loading
                    ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white glow-button cursor-pointer"
                    : "bg-white/[0.03] border border-white/[0.08] text-gray-600 cursor-not-allowed"
                }`}
              >
                {loading
                  ? "Generating your report…"
                  : isComplete
                  ? "Generate My Market Report →"
                  : "Fill in all fields to continue"}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                Your report is generated in under 2 minutes. No credit card required.
              </p>
            </div>
          </form>

          {/* What's included */}
          <div className="mt-10 glass rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-300 mb-4">
              What's included in your report
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {reportIncludes.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="w-4 h-4 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </Layout>
  );
}
