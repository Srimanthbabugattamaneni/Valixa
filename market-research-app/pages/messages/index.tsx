import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { MessageThread } from "@/lib/marketplace-types";
import type { ApiResponse } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/messages")
      .then((r) => r.json() as Promise<ApiResponse<MessageThread[]>>)
      .then((d) => {
        if (d.success) setThreads(d.data);
        else setError((d as { error: string }).error ?? "Failed to load.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [status]);

  const totalUnread = threads.reduce((s, t) => s + (t.unread_count ?? 0), 0);

  return (
    <>
      <SEO title="Messages" description="Your conversations with partners and marketplace contacts." url={`${siteConfig.url}/messages`} noIndex />
      <AppShell>
        <div className="p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Messages
                {totalUnread > 0 && (
                  <span className="ml-2 text-sm font-bold bg-gradient-to-r from-violet-500 to-blue-500 text-white px-2 py-0.5 rounded-full align-middle">
                    {totalUnread}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {threads.length === 0 ? "No conversations yet" : `${threads.length} conversation${threads.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Thread list */}
          {loading ? (
            <div className="glass rounded-2xl divide-y divide-white/[0.05]">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-white/[0.06] rounded" />
                    <div className="h-3 w-2/3 bg-white/[0.04] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="glass rounded-2xl p-16 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">No messages yet</h2>
              <p className="text-sm text-gray-500 max-w-xs mb-5">
                Browse the marketplace and contact a seller to start a conversation.
              </p>
              <Link
                href={ROUTES.marketplace}
                className="bg-gradient-to-r from-violet-500 to-blue-500 glow-button text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                Browse Marketplace
              </Link>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <ul className="divide-y divide-white/[0.05]">
                {threads.map((thread) => {
                  const isUnread = (thread.unread_count ?? 0) > 0;
                  const otherName = thread.buyer_id === userId
                    ? (thread.seller_name ?? "Seller")
                    : (thread.buyer_name ?? "Buyer");
                  const role = thread.buyer_id === userId ? "You are buying" : "You are selling";

                  return (
                    <li key={thread.id}>
                      <Link
                        href={ROUTES.thread(thread.id)}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          isUnread ? "bg-gradient-to-br from-violet-500 to-blue-500 text-white" : "bg-white/[0.06] border border-white/[0.08] text-gray-400"
                        }`}>
                          {otherName[0]?.toUpperCase() ?? "?"}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm truncate ${isUnread ? "font-bold text-white" : "font-semibold text-gray-300"}`}>
                              {thread.listing_name ?? "Business Listing"}
                            </p>
                            <span className="text-[11px] text-gray-500 shrink-0">
                              {timeAgo(thread.last_message_at ?? thread.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {otherName} · <span className="text-gray-600">{role}</span>
                          </p>
                          {thread.last_message && (
                            <p className={`text-xs mt-0.5 truncate ${isUnread ? "text-gray-300 font-medium" : "text-gray-600"}`}>
                              {thread.last_message}
                            </p>
                          )}
                        </div>

                        {/* Unread badge */}
                        {isUnread && (
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {thread.unread_count}
                          </span>
                        )}

                        <svg className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </div>
      </AppShell>
    </>
  );
}