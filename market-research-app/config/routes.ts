/** Public routes — accessible without authentication */
export const PUBLIC_ROUTES = ["/", "/analyze", "/marketplace"] as const;

/** Auth routes — redirect to dashboard if already signed in */
export const AUTH_ROUTES = ["/login", "/signup"] as const;

/** Protected routes — require authentication */
export const PROTECTED_ROUTES = [
  "/dashboard",
  "/reports",
  "/deals",
  "/messages",
  "/marketplace/new",
  "/partners/profile",
] as const;

/** API route prefixes */
export const API_ROUTES = {
  analyze: "/api/analyze",
  compare: "/api/compare",
  report: "/api/report",
  health: "/api/health",
  listings: "/api/marketplace/listings",
  partners: "/api/partners",
  messages: "/api/messages",
  deals: "/api/deals",
} as const;

/** Route path helpers */
export const ROUTES = {
  home: "/",
  analyze: "/analyze",
  compare: "/compare",
  dashboard: "/dashboard",
  reports: "/reports",
  report: (id: string) => `/reports/${id}`,
  deals: "/deals",
  messages: "/messages",
  thread: (id: string) => `/messages/${id}`,
  login: "/login",
  signup: "/signup",
  marketplace: "/marketplace",
  listing: (id: string) => `/marketplace/${id}`,
  newListing: "/marketplace/new",
  partners: "/partners",
  partnerProfile: "/partners/profile",
  partner: (id: string) => `/partners/${id}`,
} as const;
