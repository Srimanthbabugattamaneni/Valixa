// ─── Form & Input ─────────────────────────────────────────────────────────────

export interface AnalyzeFormData {
  businessBrief: string;
  zipCode: string;          // 5-digit US ZIP (mandatory)
  location: string;         // resolved city, state — auto-filled from zipCode
  businessType: string;
  budget: BudgetRange;
}

export type BudgetRange =
  | "under-10k"
  | "10k-50k"
  | "50k-250k"
  | "250k-1m"
  | "over-1m";

// ─── Report sub-types ─────────────────────────────────────────────────────────

export interface ScoreCard {
  label: string;
  score: number;
  verdict: "Strong" | "Good" | "Moderate" | "Weak" | "Poor";
  description: string;
}

export interface ChartItem {
  label: string;
  value: number;
}

export interface BurnPoint {
  month: string;
  expenses: number;
  fixed_expenses: number;
  variable_expenses: number;
  revenue: number;
  net: number;
}

export interface BreakEvenData {
  monthly_fixed_costs: number;
  variable_cost_pct: number;
  avg_transaction_value: number;
  monthly_transactions_needed: number;
  estimated_months_to_break_even: number;
}

export interface Milestone {
  month: number;
  title: string;
  tasks: string[];
}

export interface RiskItem {
  risk: string;
  probability: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
  mitigation: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  createdAt: string;
  input: AnalyzeFormData;

  feasibility_score: number;
  verdict: "Feasible" | "Risky" | "Not Recommended";
  score_cards: ScoreCard[];

  market_overview: string;
  competitor_analysis: string;
  pricing_insights: string;
  demand_analysis: string;
  risk_analysis: string;
  startup_cost_estimate: string;
  monthly_operating_cost: string;
  burn_estimate_6m: string;
  break_even_estimate: string;
  final_recommendation: string;

  setup_checklist: string[];
  milestones: Milestone[];

  startup_cost_chart: ChartItem[];
  monthly_cost_chart: ChartItem[];
  burn_chart: BurnPoint[];
  break_even_data: BreakEvenData;
  risk_heatmap: RiskItem[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
