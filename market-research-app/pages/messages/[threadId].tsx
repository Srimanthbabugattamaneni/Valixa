import { useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import type { Message, MessageThread } from "@/lib/marketplace-types";
import type { ApiResponse } from "@/lib/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ThreadPage() {
  const router     = useRouter();
  const { threadId } = router.query as { threadId: string };
  const { data: session, status } = useSession();
  const userId  = (session?.user as { id?: string })?.id ?? "";

  const [thread,   setThread]   = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
  }, [status, router]);

  useEffect(() => {
    if (!threadId || status !== "authenticated") return;
    setLoading(true);

    // Fetch messages and thread info in parallel
    Promise.all([
      fetch(`/api/messages/${threadId}`).then((r) => r.json() as Promise<ApiResponse<Message[]>>),
      fetch("/api/messages").then((r) => r.json() as Promise<ApiResponse<MessageThread[]>>),
    ])
      .then(([msgRes, threadRes]) => {
        if (msgRes.success) setMessages(msgRes.data);
        else setError((msgRes as { error: string }).error ?? "Failed to load messages.");
        if (threadRes.success) {
          const t = threadRes.data.find((th) => th.id === threadId);
          if (t) setThread(t);
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [threadId, status]);

  // Scroll to bottom when messages load/change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const res  = await fetch(`/api/messages/${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim() }),
    });
    const json = await res.json() as ApiResponse<Message>;
    if (json.success) {
      setMessages((prev) => [...prev, json.data]);
      setDraft("");
    }
    setSending(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const otherName = thread
    ? (thread.buyer_id === userId ? (thread.seller_name ?? "Seller") : (thread.buyer_name ?? "Buyer"))
    : "Conversation";

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="p-6 text-center">
          <p className="text-gray-500 text-sm mb-3">{error}</p>
          <Link href={ROUTES.messages} className="text-indigo-600 text-sm hover:underline">← Back to Messages</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <SEO title={`${otherName} — Messages`} url={`${siteConfig.url}/messages`} noIndex />
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-4rem)]">

          {/* Thread header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
            <Link href={ROUTES.messages} className="text-gray-400 hover:text-gray-700 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
              {otherName[0]?.toUpperCase() ?? "?"}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{otherName}</p>
              {thread && (
                <Link
                  href={ROUTES.listing(thread.listing_id)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 truncate block transition-colors"
                >
                  {thread.listing_name ?? "View Listing"} →
                </Link>
              )}
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No messages yet</p>
                <p className="text-xs text-gray-400">Send the first message below.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[72%] space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                      {!isOwn && (
                        <p className="text-[10px] text-gray-400 px-1">{msg.sender_name ?? otherName}</p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isOwn
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
                      }`}>
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0">
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
                className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-gray-400 leading-snug"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim() || sending}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

        </div>
      </AppShell>
    </>
  );
}
