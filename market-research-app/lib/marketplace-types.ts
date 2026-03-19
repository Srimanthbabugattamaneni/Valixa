// ─── Marketplace Listings ─────────────────────────────────────────────────────

export type ListingStatus = "draft" | "active" | "under_offer" | "sold" | "withdrawn";

export type RevenueRange =
  | "under-100k"
  | "100k-500k"
  | "500k-1m"
  | "1m-5m"
  | "over-5m";

export interface AiValuation {
  estimated_value: number;
  valuation_range: { low: number; high: number };
  confidence: "High" | "Medium" | "Low";
  risk_score: number;
  key_value_drivers: string[];
  risk_factors: string[];
  comparable_sales: string;
  recommendation: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  seller_name?: string;
  business_name: string;
  industry: string;
  location: string;
  description: string;
  revenue_range: string;
  profit_margin: number | null;
  asking_price: number;
  assets_included: string | null;
  employees: number;
  years_in_operation: number;
  reason_for_selling: string | null;
  ai_valuation: AiValuation | null;
  status: ListingStatus;
  views: number;
  is_saved?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateListingInput {
  business_name: string;
  industry: string;
  location: string;
  description: string;
  revenue_range: string;
  profit_margin?: number;
  asking_price: number;
  assets_included?: string;
  employees: number;
  years_in_operation: number;
  reason_for_selling?: string;
  status?: ListingStatus;
}

// ─── Partner Profiles ─────────────────────────────────────────────────────────

export type PartnerRole =
  | "technical"
  | "operations"
  | "investor"
  | "marketing"
  | "sales"
  | "other";

export type BusinessStage = "idea" | "early" | "growth" | "established";

export type CapitalRange =
  | "under-10k"
  | "10k-50k"
  | "50k-250k"
  | "250k-1m"
  | "over-1m";

export interface PartnerProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  skills: string[];
  industry_expertise: string[];
  role: PartnerRole;
  capital_available: CapitalRange | null;
  preferred_industries: string[];
  preferred_stage: BusinessStage | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // enriched by matching
  compatibility_score?: number;
  match_reasons?: string[];
}

export interface UpsertPartnerProfileInput {
  display_name: string;
  bio?: string;
  location?: string;
  skills: string[];
  industry_expertise: string[];
  role: PartnerRole;
  capital_available?: CapitalRange;
  preferred_industries: string[];
  preferred_stage?: BusinessStage;
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export type DealStage =
  | "inquiry"
  | "nda_signed"
  | "due_diligence"
  | "offer_made"
  | "offer_accepted"
  | "closed"
  | "withdrawn";

export interface Deal {
  id: string;
  listing_id: string;
  listing_name?: string;
  buyer_id: string;
  buyer_name?: string;
  seller_id: string;
  seller_name?: string;
  stage: DealStage;
  offer_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export interface MessageThread {
  id: string;
  listing_id: string;
  listing_name?: string;
  buyer_id: string;
  buyer_name?: string;
  seller_id: string;
  seller_name?: string;
  last_message_at: string;
  created_at: string;
  unread_count?: number;
  last_message?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  read_at: string | null;
  created_at: string;
}
