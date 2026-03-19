import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { CreateListingInput } from "@/lib/marketplace-types";

const INDUSTRIES = [
  "Food & Beverage","Retail","Technology","Health & Wellness","Education",
  "Services","Real Estate","Manufacturing","Hospitality","Finance","Other",
];

const REVENUE_RANGES = [
  "under-100k","100k-500k","500k-1m","1m-5m","over-5m",
];

const REVENUE_LABELS: Record<string, string> = {
  "under-100k": "Under $100k / yr",
  "100k-500k":  "$100k – $500k / yr",
  "500k-1m":    "$500k – $1M / yr",
  "1m-5m":      "$1M – $5M / yr",
  "over-5m":    "Over $5M / yr",
};

export default function NewListingPage() {
  const router  = useRouter();
  const { data: session, status } = useSession();

  const [form, setForm] = useState<CreateListingInput>({
    business_name: "",
    industry: INDUSTRIES[0],
    location: "",
    description: "",
    revenue_range: REVENUE_RANGES[0],
    profit_margin: undefined,
    asking_price: 0,
    assets_included: "",
    employees: 0,
    years_in_operation: 0,
    reason_for_selling: "",
    status: "active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (status === "loading") return null;
  if (!session) {
    return (
      <Layout>
        <main className="pt-32 text-center">
          <p className="text-gray-500 mb-4">You need to be signed in to list a business.</p>
          <Link href={ROUTES.login} className="text-indigo-600 font-medium hover:underline">Sign In</Link>
        </main>
      </Layout>
    );
  }

  function update(key: keyof CreateListingInput, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res  = await fetch("/api/marketplace/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        asking_price:       Number(form.asking_price),
        employees:          Number(form.employees),
        years_in_operation: Number(form.years_in_operation),
        profit_margin:      form.profit_margin ? Number(form.profit_margin) : undefined,
      }),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error ?? "Failed to create listing");
      setLoading(false);
      return;
    }

    router.push(ROUTES.listing(data.data.id));
  }

  const required = !form.business_name || !form.location || !form.description || !form.asking_price || !form.years_in_operation;

  return (
    <Layout>
      <Head><title>{`List Your Business — ${siteConfig.name}`}</title></Head>
      <main className="pt-24 pb-16 min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <div className="mb-8">
            <Link href={ROUTES.marketplace} className="text-sm text-gray-400 hover:text-indigo-600">← Back to Marketplace</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">List Your Business</h1>
            <p className="text-gray-500 text-sm">Fill in the details below. You can generate an AI valuation after publishing.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">

            <Field label="Business Name" required>
              <input type="text" value={form.business_name} onChange={(e) => update("business_name", e.target.value)}
                placeholder="e.g. Austin Brew Co" className={inputCls} required />
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Industry" required>
                <select value={form.industry} onChange={(e) => update("industry", e.target.value)} className={inputCls}>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Location" required>
                <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)}
                  placeholder="City, State" className={inputCls} required />
              </Field>
            </div>

            <Field label="Description" required hint="2–4 paragraphs about the business, its history, and what makes it valuable">
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)}
                rows={5} placeholder="Describe the business…" className={`${inputCls} resize-none`} required />
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Annual Revenue Range" required>
                <select value={form.revenue_range} onChange={(e) => update("revenue_range", e.target.value)} className={inputCls}>
                  {REVENUE_RANGES.map((r) => <option key={r} value={r}>{REVENUE_LABELS[r]}</option>)}
                </select>
              </Field>
              <Field label="Profit Margin (%)" hint="Optional">
                <input type="number" min="0" max="100" step="0.1"
                  value={form.profit_margin ?? ""} onChange={(e) => update("profit_margin", e.target.value)}
                  placeholder="e.g. 18" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Asking Price (USD)" required>
                <input type="number" min="1" step="1000"
                  value={form.asking_price || ""} onChange={(e) => update("asking_price", e.target.value)}
                  placeholder="e.g. 650000" className={inputCls} required />
              </Field>
              <Field label="Employees">
                <input type="number" min="0"
                  value={form.employees} onChange={(e) => update("employees", e.target.value)}
                  placeholder="0" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Years in Operation" required>
                <input type="number" min="0"
                  value={form.years_in_operation || ""} onChange={(e) => update("years_in_operation", e.target.value)}
                  placeholder="e.g. 5" className={inputCls} required />
              </Field>
              <Field label="Listing Status">
                <select value={form.status} onChange={(e) => update("status", e.target.value as "draft" | "active")} className={inputCls}>
                  <option value="active">Active (public)</option>
                  <option value="draft">Draft (private)</option>
                </select>
              </Field>
            </div>

            <Field label="Assets Included" hint="Equipment, inventory, IP, customer lists, etc.">
              <textarea value={form.assets_included} onChange={(e) => update("assets_included", e.target.value)}
                rows={2} placeholder="List key assets included in the sale…" className={`${inputCls} resize-none`} />
            </Field>

            <Field label="Reason for Selling" hint="Helps buyers understand your motivation">
              <textarea value={form.reason_for_selling} onChange={(e) => update("reason_for_selling", e.target.value)}
                rows={2} placeholder="e.g. Retiring, pursuing other ventures…" className={`${inputCls} resize-none`} />
            </Field>

            <button
              type="submit"
              disabled={loading || required}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {loading ? "Publishing…" : "Publish Listing"}
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
