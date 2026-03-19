import SEO from "@/components/SEO";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/config/routes";
import type { PartnerProfile, PartnerRole } from "@/lib/marketplace-types";
import type { ApiResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLE_COLORS: Record<PartnerRole, string> = {
  technical:  "bg-blue-50 text-blue-700 border-blue-200",
  operations: "bg-green-50 text-green-700 border-green-200",
  investor:   "bg-purple-50 text-purple-700 border-purple-200",
  marketing:  "bg-pink-50 text-pink-700 border-pink-200",
  sales:      "bg-orange-50 text-orange-700 border-orange-200",
  other:      "bg-gray-100 text-gray-600 border-gray-200",
};

const CAPITAL_LABELS: Record<string, string> = {
  "under-10k":  "Under $10,000",
  "10k-50k":    "$10,000 – $50,000",
  "50k-250k":   "$50,000 – $250,000",
  "250k-1m":    "$250,000 – $1M",
  "over-1m":    "Over $1M",
};

const STAGE_LABELS: Record<string, string> = {
  idea:        "Idea Stage",
  early:       "Early Stage",
  growth:      "Growth Stage",
  established: "Established",
};

export default function PartnerDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;

  const { data } = useSWR<ApiResponse<PartnerProfile>>(
    id ? `/api/partners/${id}` : null,
    fetcher
  );

  const partner = data?.success ? data.data : null;
  const isOwn = partner && currentUserId === partner.user_id;

  if (!data) {
    return (
      <Layout>
        <div className="pt-24 pb-16 min-h-screen bg-gray-50">
          <div className="max-w-3xl mx-auto px-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-pulse h-96" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!partner) {
    return (
      <Layout>
        <div className="pt-24 pb-16 min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-2">Partner not found</p>
            <p className="text-gray-500 mb-6">This profile may have been removed or made private.</p>
            <Link href={ROUTES.partners} className="text-indigo-600 font-medium hover:underline">
              ← Back to Find Partners
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const roleColor = ROLE_COLORS[partner.role as PartnerRole] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <Layout>
      <SEO title={partner.display_name} description={`${partner.display_name} is looking for a partner on Valixa. Role: ${partner.role}.`} url={`${siteConfig.url}/partners/${partner.id}`} />

      <main className="pt-24 pb-16 min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">

          {/* Back */}
          <Link
            href={ROUTES.partners}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
          >
            ← Back to Find Partners
          </Link>

          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">

              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-3xl shrink-0">
                {partner.display_name.charAt(0).toUpperCase()}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{partner.display_name}</h1>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${roleColor}`}>
                    {partner.role}
                  </span>
                </div>

                {partner.location && (
                  <p className="text-sm text-gray-500 mb-3">📍 {partner.location}</p>
                )}

                {partner.bio && (
                  <p className="text-gray-600 leading-relaxed">{partner.bio}</p>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex flex-col gap-2">
                {isOwn ? (
                  <Link
                    href={ROUTES.partnerProfile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors text-center"
                  >
                    Edit Profile
                  </Link>
                ) : session ? (
                  <a
                    href={`mailto:?subject=Partnership Inquiry via ${siteConfig.name}`}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors text-center"
                  >
                    Contact Partner
                  </a>
                ) : (
                  <Link
                    href={ROUTES.login}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors text-center"
                  >
                    Sign in to Connect
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">

            {/* Skills */}
            {partner.skills?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {partner.skills.map((s) => (
                    <span key={s} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Industry expertise */}
            {partner.industry_expertise?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Industry Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {partner.industry_expertise.map((i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Investment profile */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Investment Profile</h2>
              <dl className="space-y-3">
                {partner.capital_available && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Capital Available</dt>
                    <dd className="font-medium text-gray-900">{CAPITAL_LABELS[partner.capital_available] ?? partner.capital_available}</dd>
                  </div>
                )}
                {partner.preferred_stage && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Preferred Stage</dt>
                    <dd className="font-medium text-gray-900 capitalize">{STAGE_LABELS[partner.preferred_stage] ?? partner.preferred_stage}</dd>
                  </div>
                )}
                {partner.role && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Role</dt>
                    <dd className="font-medium text-gray-900 capitalize">{partner.role}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Preferred industries */}
            {partner.preferred_industries?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Looking to Invest In</h2>
                <div className="flex flex-wrap gap-2">
                  {partner.preferred_industries.map((i) => (
                    <span key={i} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA for unauthenticated users */}
          {!session && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
              <p className="text-gray-700 font-medium mb-1">Want to connect with {partner.display_name}?</p>
              <p className="text-sm text-gray-500 mb-4">Create a free account to send a partnership inquiry.</p>
              <Link
                href={ROUTES.signup}
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          )}

        </div>
      </main>
    </Layout>
  );
}
