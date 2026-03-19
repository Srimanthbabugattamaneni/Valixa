export const siteConfig = {
  name: "Valixa",
  fullName: "Validate Your Idea",
  description:
    "Automate competitor analysis, demographic insights, pricing benchmarks, and financial projections for any business idea.",
  tagline: "Validate Your Idea",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  nav: [
    { label: "Features",     href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Who It's For", href: "/#users" },
    { label: "Marketplace",  href: "/marketplace" },
    { label: "Find Partners",href: "/partners" },
  ],

  social: {
    twitter: "",
    github: "",
  },
};
