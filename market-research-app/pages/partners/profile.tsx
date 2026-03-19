import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { PartnerProfile, PartnerRole, CapitalRange, BusinessStage } from "@/lib/marketplace-types";

const ROLES: { value: PartnerRole; label: string; desc: string }[] = [
  { value: "technical",   label: "Technical",   desc: "Engineering, product, tech" },
  { value: "operations",  label: "Operations",  desc: "Ops, logistics, management" },
  { value: "investor",    label: "Investor",    desc: "Capital & strategic guidance" },
  { value: "marketing",   label: "Marketing",   desc: "Growth, brand, content" },
  { value: "sales",       label: "Sales",       desc: "Revenue, BD, partnerships" },
  { value: "other",       label: "Other",       desc: "Generalist / other expertise" },
];

const CAPITAL_OPTIONS: { value: CapitalRange; label: string }[] = [
  { value: "under-10k", label: "Under $10k" },
  { value: "10k-50k",   label: "$10k – $50k" },
  { value: "50k-250k",  label: "$50k – $250k" },
  { value: "250k-1m",   label: "$250k – $1M" },
  { value: "over-1m",   label: "Over $1M" },
];

const STAGE_OPTIONS: { value: BusinessStage; label: string }[] = [
  { value: "idea",        label: "Idea stage" },
  { value: "early",       label: "Early stage" },
  { value: "growth",      label: "Growth stage" },
  { value: "established", label: "Established" },
];

const INDUSTRIES = [
  "Food & Beverage","Retail","Technology","Health & Wellness","Education",
  "Services","Real Estate","Manufacturing","Hospitality","Finance","Other",
];

export default function PartnerProfilePage() {
  const router  = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const [form, setForm] = useState({
    display_name:        "",
    bio:                 "",
    location:            "",
    role:                "technical" as PartnerRole,
    capital_available:   "" as CapitalRange | "",
    preferred_stage:     "" as BusinessStage | "",
    skills:              "",          // comma-separated input
    industry_expertise:  [] as string[],
    preferred_industries:[] as string[],
  });

  // Load existing profile if any
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/partners/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          const p: PartnerProfile = data.data;
          setForm({
            display_name:        p.display_name,
            bio:                 p.bio ?? "",
            location:            p.location ?? "",
            role:                p.role,
            capital_available:   p.capital_available ?? "",
            preferred_stage:     p.preferred_stage ?? "",
            skills:              (p.skills ?? []).join(", "),
            industry_expertise:  p.industry_expertise ?? [],
            preferred_industries:p.preferred_industries ?? [],
          });
        }
      })
      .finally(() => setFetching(false));
  }, [status]);

  if (status === "loading" || fetching) return null;
  if (!session) {
    return (
      <Layout>
        <main className="pt-32 text-center">
          <p className="text-gray-500 mb-4">Sign in to create your partner profile.</p>
          <Link href={ROUTES.login} className="text-indigo-600 font-medium hover:underline">Sign In</Link>
        </main>
      </Layout>
    );
  }

  function toggleArray(field: "industry_expertise" | "preferred_industries", val: string) {
    setForm((f) => {
      const arr = f[field];
      return {
        ...f,
        [field]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      display_name:        form.display_name,
      bio:                 form.bio || undefined,
      location:            form.location || undefined,
      role:                form.role,
      capital_available:   form.capital_available || undefined,
      preferred_stage:     form.preferred_stage || undefined,
      skills:              form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      industry_expertise:  form.industry_expertise,
      preferred_industries:form.preferred_industries,
    };

    const res  = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error ?? "Failed to save profile");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push(ROUTES.partners), 1500);
  }

  return (
    <Layout>
      <SEO title="Partner Profile" description="Set up your partner profile to get discovered by co-founders and investors on Valixa." url={`${siteConfig.url}/partners/profile`} noIndex />
      <main className="pt-24 pb-16 min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <div className="mb-8">
            <Link href={ROUTES.partners} className="text-sm text-gray-400 hover:text-indigo-600">← Back to Partners</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Your Partner Profile</h1>
            <p className="text-gray-500 text-sm">Be discoverable by other founders, operators, and investors.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-6">
              Profile saved! Redirecting…
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">

            <div className="grid grid-cols-2 gap-5">
              <Field label="Display Name" required>
                <input type="text" value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Jane Smith" className={inputCls} required />
              </Field>
              <Field label="Location" hint="City, State">
                <input type="text" value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Austin, TX" className={inputCls} />
              </Field>
            </div>

            <Field label="Short Bio" hint="2–3 sentences about yourself">
              <textarea value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3} placeholder="I'm a former SaaS founder with 10 years in B2B sales…"
                className={`${inputCls} resize-none`} />
            </Field>

            <Field label="Your Role" required>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ROLES.map((r) => (
                  <button key={r.value} type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                    className={`text-left px-4 py-3 rounded-xl border transition-all ${
                      form.role === r.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}>
                    <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Skills" hint="Comma-separated, e.g. React, Fundraising, SEO">
              <input type="text" value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="React, Python, Fundraising, SEO…" className={inputCls} />
            </Field>

            <Field label="Industry Expertise" hint="Select all that apply">
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button key={ind} type="button"
                    onClick={() => toggleArray("industry_expertise", ind)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.industry_expertise.includes(ind)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold"
                        : "border-gray-200 text-gray-600 hover:border-indigo-200"
                    }`}>{ind}</button>
                ))}
              </div>
            </Field>

            <Field label="Preferred Industries to Partner In" hint="What sectors are you looking to enter?">
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button key={ind} type="button"
                    onClick={() => toggleArray("preferred_industries", ind)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.preferred_industries.includes(ind)
                        ? "border-purple-500 bg-purple-50 text-purple-700 font-semibold"
                        : "border-gray-200 text-gray-600 hover:border-purple-200"
                    }`}>{ind}</button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Capital Available" hint="Optional">
                <select value={form.capital_available}
                  onChange={(e) => setForm((f) => ({ ...f, capital_available: e.target.value as CapitalRange | "" }))}
                  className={inputCls}>
                  <option value="">Not specified</option>
                  {CAPITAL_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Preferred Stage">
                <select value={form.preferred_stage}
                  onChange={(e) => setForm((f) => ({ ...f, preferred_stage: e.target.value as BusinessStage | "" }))}
                  className={inputCls}>
                  <option value="">Any stage</option>
                  {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>

            <button
              type="submit"
              disabled={loading || !form.display_name}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Saving…" : "Save Profile"}
            </button>
          </form>
        </div>
      </main>
    </Layout>
  );
}

const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300";

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
