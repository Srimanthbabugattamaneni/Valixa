import { useEffect, useRef, useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";

/* ── Data ──────────────────────────────────────────────────────────────────── */

const problems = [
  {
    icon: "⏱",
    title: "Time-Consuming Research",
    description:
      "Manual market research takes weeks of gathering data from scattered sources, delaying critical business decisions.",
    color: "from-orange-500/20 to-red-500/20",
  },
  {
    icon: "📉",
    title: "Unreliable Insights",
    description:
      "Fragmented data across search engines and directories leads to incomplete or misleading market signals.",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: "🏙",
    title: "Competitor Blind Spots",
    description:
      "Understanding competitor density and positioning is difficult without dedicated tools and expertise.",
    color: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: "💸",
    title: "Expensive Consulting",
    description:
      "Professional research services are out of reach for most founders and small businesses.",
    color: "from-emerald-500/20 to-teal-500/20",
  },
];

const features = [
  {
    icon: "🔍",
    title: "Multi-Source Data Collection",
    description:
      "Automatically pulls real-world data from business directories, demographic databases, and market sources.",
    accent: "violet",
  },
  {
    icon: "🤖",
    title: "AI-Powered Analysis",
    description:
      "State-of-the-art AI models analyze the data and surface patterns, risks, and opportunities specific to your idea.",
    accent: "blue",
  },
  {
    icon: "📊",
    title: "Structured Reports",
    description:
      "Receive a complete market research report — competitor analysis, pricing benchmarks, demographics, and projections.",
    accent: "cyan",
  },
  {
    icon: "⚡",
    title: "Results in Minutes",
    description:
      "What takes weeks of manual work is delivered in minutes. Just enter your idea and location.",
    accent: "violet",
  },
  {
    icon: "📍",
    title: "Location Intelligence",
    description:
      "Hyper-local insights tailored to your target market's geography, so you understand the landscape before you launch.",
    accent: "blue",
  },
  {
    icon: "✅",
    title: "Actionable Decisions",
    description:
      "Every report concludes with clear, data-driven recommendations to help you move forward with confidence.",
    accent: "cyan",
  },
];

const users = [
  { role: "Entrepreneurs", description: "Evaluate a new business idea before investing time and money.", emoji: "💡" },
  { role: "Startup Founders", description: "Validate product-market fit early with real data.", emoji: "🚀" },
  { role: "Consultants", description: "Deliver professional feasibility studies to clients faster.", emoji: "🧠" },
  { role: "Agencies", description: "Power market and strategy reports at scale.", emoji: "🏢" },
  { role: "Investors", description: "Quickly analyze potential opportunities and market dynamics.", emoji: "📈" },
];

const steps = [
  { step: "01", title: "Enter Your Idea", description: "Describe your business concept and target location." },
  { step: "02", title: "AI Collects Data", description: "The platform pulls data from multiple real-world sources automatically." },
  { step: "03", title: "Get Your Report", description: "Receive a structured, actionable market research report in minutes." },
];

const accentBorder: Record<string, string> = {
  violet: "hover:border-violet-500/30",
  blue: "hover:border-blue-500/30",
  cyan: "hover:border-cyan-500/30",
};

const accentGlow: Record<string, string> = {
  violet: "hover:shadow-violet-500/10",
  blue: "hover:shadow-blue-500/10",
  cyan: "hover:shadow-cyan-500/10",
};

/* ── Example report carousel ───────────────────────────────────────────────── */

const EXAMPLES = [
  {
    title: "Coffee Shop",
    location: "Austin, TX",
    verdict: "Feasible",
    score: 78,
    stats: [
      { label: "Competitors Nearby", value: "14" },
      { label: "Market Size", value: "$2.4M" },
      { label: "Avg. Ticket Price", value: "$6.80" },
      { label: "Viability Score", value: "78/100" },
    ],
  },
  {
    title: "Boutique Fitness Studio",
    location: "Nashville, TN",
    verdict: "Feasible",
    score: 82,
    stats: [
      { label: "Competitors Nearby", value: "7" },
      { label: "Market Size", value: "$1.8M" },
      { label: "Avg. Monthly Fee", value: "$120" },
      { label: "Viability Score", value: "82/100" },
    ],
  },
  {
    title: "Ghost Kitchen — Indian Cuisine",
    location: "Chicago, IL",
    verdict: "Risky",
    score: 54,
    stats: [
      { label: "Competitors Nearby", value: "31" },
      { label: "Market Size", value: "$3.1M" },
      { label: "Avg. Order Value", value: "$28" },
      { label: "Viability Score", value: "54/100" },
    ],
  },
  {
    title: "Pet Grooming Salon",
    location: "Denver, CO",
    verdict: "Feasible",
    score: 74,
    stats: [
      { label: "Competitors Nearby", value: "9" },
      { label: "Market Size", value: "$890K" },
      { label: "Avg. Session Price", value: "$65" },
      { label: "Viability Score", value: "74/100" },
    ],
  },
  {
    title: "Co-Working Space",
    location: "Miami, FL",
    verdict: "Risky",
    score: 49,
    stats: [
      { label: "Competitors Nearby", value: "22" },
      { label: "Market Size", value: "$5.6M" },
      { label: "Avg. Desk/Mo", value: "$350" },
      { label: "Viability Score", value: "49/100" },
    ],
  },
];

const VERDICT_STYLES: Record<string, string> = {
  Feasible: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Risky: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Not Recommended": "bg-red-500/10 text-red-400 border-red-500/20",
};

function ExampleReportCarousel() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(idx: number) {
    if (idx === active) return;
    setFading(true);
    setTimeout(() => {
      setActive(idx);
      setFading(false);
    }, 220);
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => goTo((active + 1) % EXAMPLES.length), 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const ex = EXAMPLES[active];

  return (
    <div className="mt-20 max-w-3xl mx-auto animate-fade-in-scale stagger-5">
      <div
        className="glass-strong rounded-2xl p-8 text-left transition-opacity duration-200"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
              Market Research Report
            </p>
            <h3 className="text-lg font-bold text-white">{ex.title} — {ex.location}</h3>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${VERDICT_STYLES[ex.verdict]}`}>
            {ex.verdict === "Feasible" ? "✓" : ex.verdict === "Risky" ? "⚠" : "✕"} {ex.verdict}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ex.stats.map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div className="mt-5 h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-blue-400 rounded-full transition-all duration-700"
            style={{ width: `${ex.score}%` }}
          />
        </div>

        {/* Dot navigation */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {EXAMPLES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? "w-5 h-1.5 bg-violet-400"
                  : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Example ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Scroll-reveal hook ────────────────────────────────────────────────────── */

function useReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const children = el.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return containerRef;
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function Home() {
  const revealRef = useReveal();
  const router = useRouter();
  const { data: session } = useSession();
  const [idea, setIdea] = useState("");

  function handleSend() {
    const trimmed = idea.trim();
    if (!trimmed) return;
    if (!session) {
      const analyzeUrl = `${ROUTES.analyze}?brief=${encodeURIComponent(trimmed)}`;
      router.push(`${ROUTES.login}?callbackUrl=${encodeURIComponent(analyzeUrl)}`);
    } else {
      router.push(`${ROUTES.analyze}?brief=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <Layout>
      <SEO
        title="Validate Your Business Idea with AI"
        description="Enter your business idea and get a full market research report in minutes — competitor analysis, demographics, pricing, and a feasibility score."
        url={siteConfig.url}
      />

      <div ref={revealRef}>
        {/* ───────────────────── HERO ───────────────────── */}
        <section className="relative pt-36 pb-28 px-6 text-center overflow-hidden">
          {/* Mesh gradient blobs */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-transparent blur-3xl animate-pulse-glow" />
            <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-violet-500/8 blur-3xl" />
            <div className="absolute top-[5%] right-[15%] w-72 h-72 rounded-full bg-blue-500/8 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 animate-fade-in-up">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              AI-Powered Market Research
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 animate-fade-in-up stagger-1">
              <span className="text-white">
                {siteConfig.tagline.split("in Minutes")[0]}
              </span>
              <span className="gradient-text">in Minutes</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up stagger-2">
              {siteConfig.description}
            </p>

            {/* Idea input box */}
            <div className="animate-fade-in-up stagger-3 max-w-2xl mx-auto w-full">
              <div className="relative group">
                {/* Outer animated gradient glow (visible on focus within) */}
                <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-2xl blur-md opacity-20 group-focus-within:opacity-60 transition-opacity duration-500" />
                <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

                <div className="relative bg-[#09090b]/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-2 flex flex-col transition-all duration-300">
                  {/* Subtle top highlight line */}
                  <div className="absolute top-0 inset-x-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

                  <textarea
                    rows={1}
                    value={idea}
                    onChange={(e) => {
                      setIdea(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                    }}
                    onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Describe your business idea... e.g. a specialty coffee shop targeting remote workers"
                    className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-base sm:text-lg leading-relaxed resize-none outline-none py-3 px-4 min-h-[52px]"
                    style={{ overflowY: idea.split('\n').length > 5 ? 'auto' : 'hidden' }}
                  />

                  <div className="flex items-center justify-between px-2 pb-1 pt-2 border-t border-transparent group-focus-within:border-white/[0.04] transition-colors">
                    {/* Keyboard hint */}
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-medium text-gray-500 transition-opacity duration-300 ${
                        idea.trim() ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="hidden sm:inline">Press</span>
                      <kbd className="px-1.5 py-0.5 mb-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono text-[10px] text-gray-400">
                        Enter ↵
                      </kbd>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={handleSend}
                      disabled={!idea.trim()}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        idea.trim()
                          ? "bg-gradient-to-br from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white shadow-lg shadow-violet-500/25 scale-100"
                          : "bg-white/[0.04] text-gray-600 cursor-not-allowed scale-95"
                      }`}
                      aria-label="Analyze idea"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-600 font-medium tracking-wide text-center uppercase">
                Free Report · No Credit Card Required
              </p>
            </div>
          </div>

          {/* ── Rotating example report cards ───────────────────────── */}
          <ExampleReportCarousel />
        </section>

        {/* ───────────────────── PROBLEM ───────────────────── */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent -z-10" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 reveal">
              <p className="gradient-text font-semibold text-sm uppercase tracking-wider mb-3">
                The Problem
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Market research is broken for founders
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Existing solutions are either expensive consulting services or
                fragmented research across dozens of sources.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {problems.map((p, i) => (
                <div
                  key={p.title}
                  className={`reveal glass rounded-2xl p-6 card-hover gradient-border`}
                  style={{ transitionDelay: `${i * 0.1}s` }}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl mb-4`}
                  >
                    {p.icon}
                  </div>
                  <h3 className="font-semibold text-gray-200 mb-2">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────────────── FEATURES ───────────────────── */}
        <section id="features" className="py-24 px-6 relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 reveal">
              <p className="gradient-text font-semibold text-sm uppercase tracking-wider mb-3">
                The Solution
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Everything you need to validate fast
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                One platform that collects, analyzes, and presents the market
                data you need — automatically.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`reveal glass rounded-2xl p-7 card-hover ${accentBorder[f.accent]} ${accentGlow[f.accent]} hover:shadow-lg transition-all`}
                  style={{ transitionDelay: `${i * 0.08}s` }}
                >
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="font-semibold text-gray-200 mb-2 text-lg">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>


        

        {/* ───────────────────── MARKETPLACE ───────────────────── */}
        <section id="marketplace" className="py-24 px-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 right-[10%] w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />
            <div className="absolute top-1/3 left-[5%] w-72 h-72 rounded-full bg-blue-500/5 blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Text */}
              <div className="reveal">
                <p className="text-emerald-400 font-semibold text-sm uppercase tracking-wider mb-3">Marketplace</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
                  Your next big move<br />might already exist
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  Don&apos;t start from zero. Browse real businesses for sale — validated with market data — or list your own. Find the opportunity that fits your budget, location, and ambition.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Browse vetted businesses across every industry",
                    "Filter by location, price, and sector",
                    "Each listing backed by real market context",
                    "List your own business to reach serious buyers",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-gray-400 text-sm">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={ROUTES.marketplace} className="inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 font-semibold px-6 py-3 rounded-xl text-sm transition-all">
                  Browse the Marketplace →
                </Link>
              </div>

              {/* Mock listing cards */}
              <div className="reveal space-y-3">
                {[
                  { name: "Craft Brewery", location: "Portland, OR", price: "$420k", industry: "Food & Beverage", score: 76 },
                  { name: "Yoga Studio Chain", location: "Austin, TX", price: "$185k", industry: "Health & Wellness", score: 82 },
                  { name: "E-Commerce Brand", location: "Remote", price: "$2.1M", industry: "Retail", score: 69 },
                ].map((biz, i) => (
                  <div key={biz.name} className="glass rounded-xl p-4 flex items-center gap-4 card-hover" style={{ transitionDelay: `${i * 0.08}s` }}>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/[0.06] flex items-center justify-center text-lg shrink-0">
                      {i === 0 ? "🍺" : i === 1 ? "🧘" : "🛍"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{biz.name}</p>
                      <p className="text-gray-500 text-xs">{biz.location} · {biz.industry}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-bold text-sm">{biz.price}</p>
                      <p className="text-emerald-400 text-xs">Score {biz.score}/100</p>
                    </div>
                  </div>
                ))}
                <p className="text-center text-gray-600 text-xs pt-1">Sample listings · Real data on each</p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────── PARTNERS ───────────────────── */}
        <section id="partners" className="py-24 px-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-violet-500/8 to-transparent blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Mock partner cards — left on this section */}
              <div className="reveal order-2 lg:order-1 grid grid-cols-2 gap-3">
                {[
                  { name: "Priya M.", role: "Technical", capital: "$50k–$250k", skills: "Full-stack · AI", emoji: "👩‍💻" },
                  { name: "James R.", role: "Investor", capital: "$250k–$1M", skills: "SaaS · Retail", emoji: "📈" },
                  { name: "Sofia K.", role: "Marketing", capital: "$10k–$50k", skills: "Growth · Brand", emoji: "🎯" },
                  { name: "Arun P.", role: "Operations", capital: "$50k–$250k", skills: "Supply chain · Ops", emoji: "⚙️" },
                ].map((p, i) => (
                  <div key={p.name} className="glass rounded-xl p-4 card-hover" style={{ transitionDelay: `${i * 0.07}s` }}>
                    <div className="text-2xl mb-2">{p.emoji}</div>
                    <p className="text-white font-semibold text-sm">{p.name}</p>
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 mb-2">{p.role}</span>
                    <p className="text-gray-500 text-xs leading-relaxed">{p.skills}</p>
                    <p className="text-gray-600 text-xs mt-1">{p.capital}</p>
                  </div>
                ))}
              </div>

              {/* Text */}
              <div className="reveal order-1 lg:order-2">
                <p className="gradient-text font-semibold text-sm uppercase tracking-wider mb-3">Partners</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
                  Great businesses are<br />built with the right people
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  You have the idea. Now find the person who brings what you don&apos;t — a technical co-founder, a seasoned operator, an investor ready to back you. Your next partner is looking for you too.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Browse co-founders, investors, and operators",
                    "Filter by role, location, and capital available",
                    "Message directly — no middlemen",
                    "Create your own profile to get discovered",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-gray-400 text-sm">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={ROUTES.partners} className="inline-flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 text-violet-300 font-semibold px-6 py-3 rounded-xl text-sm transition-all">
                  Find Your Partner →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────── WHO IT'S FOR ───────────────────── */}
        <section id="users" className="py-24 px-6 relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 reveal">
              <p className="gradient-text font-semibold text-sm uppercase tracking-wider mb-3">
                Who It&apos;s For
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Built for every stage of the journey
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Whether you&apos;re just getting started or advising others,{" "}
                {siteConfig.name} fits your workflow.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              {users.map((u, i) => (
                <div
                  key={u.role}
                  className="reveal flex items-start gap-4 glass rounded-2xl p-6 card-hover gradient-border w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
                  style={{ transitionDelay: `${i * 0.08}s` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/15 border border-white/[0.06] flex items-center justify-center text-2xl shrink-0">
                    {u.emoji}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-200 mb-1">
                      {u.role}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {u.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
