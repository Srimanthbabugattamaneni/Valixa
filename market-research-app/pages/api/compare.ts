import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiResponse } from "@/lib/types";

const FASTAPI_BASE_URL  = process.env.FASTAPI_BASE_URL  ?? "http://localhost:8000";
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY ?? "";

export interface LocationResult {
  location: string;
  zip_code: string;
  feasibility_score: number;
  verdict: "Feasible" | "Risky" | "Not Recommended";
  market_overview: string;
  competitor_analysis: string;
  pricing_insights: string;
  final_recommendation: string;
  startup_cost_estimate: string;
  break_even_months: number;
  risk_level: "Low" | "Medium" | "High";
  high_risk_count: number;
  score_cards: Array<{ label: string; score: number; verdict: string; description: string }>;
  error?: string;
}

export interface CompareResult {
  businessBrief: string;
  businessType: string;
  budget: string;
  locations: LocationResult[];
  winner: string; // location name of highest scoring city
}

async function analyzeLocation(
  businessBrief: string,
  location: string,
  zip_code: string,
): Promise<LocationResult> {
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/api/v1/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AI_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        business_idea: businessBrief.trim(),
        location:      location.trim() || zip_code,
        zip_code,
      }),
      // Each call can take up to 120s
    });

    if (!res.ok) {
      throw new Error(`FastAPI returned ${res.status}`);
    }

    const ai = await res.json();
    const score: number = Number(ai.feasibility_score ?? 50);
    const verdict = score >= 70 ? "Feasible" : score >= 45 ? "Risky" : "Not Recommended";
    const highRiskCount = (ai.risk_heatmap ?? []).filter(
      (r: { probability: string; impact: string }) => r.probability === "High" || r.impact === "High",
    ).length;

    return {
      location: location.trim() || `ZIP ${zip_code}`,
      zip_code,
      feasibility_score: score,
      verdict: verdict as LocationResult["verdict"],
      market_overview:       ai.market_overview        ?? "",
      competitor_analysis:   ai.competitor_analysis    ?? "",
      pricing_insights:      ai.pricing_insights       ?? "",
      final_recommendation:  ai.final_recommendation   ?? "",
      startup_cost_estimate: ai.startup_cost_estimate  ?? "",
      break_even_months:     ai.break_even_data?.estimated_months_to_break_even ?? 0,
      risk_level: score >= 70 ? "Low" : score >= 45 ? "Medium" : "High",
      high_risk_count: highRiskCount,
      score_cards: ai.score_cards ?? [],
    };
  } catch (err) {
    console.error(`[/api/compare] Error for zip "${zip_code}":`, err);
    return {
      location: location.trim() || `ZIP ${zip_code}`,
      zip_code,
      feasibility_score: 0,
      verdict: "Not Recommended",
      market_overview: "",
      competitor_analysis: "",
      pricing_insights: "",
      final_recommendation: "",
      startup_cost_estimate: "",
      break_even_months: 0,
      risk_level: "High",
      high_risk_count: 0,
      score_cards: [],
      error: "Analysis failed for this location. Please try again.",
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<CompareResult>>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Accept either zip-based { zipEntries: [{zip, label}] } or legacy { locations: string[] }
  const { businessBrief, businessType, budget, zipEntries } = req.body;

  if (!businessBrief || !businessType || !budget) {
    return res.status(400).json({ success: false, error: "Missing required fields", code: "MISSING_FIELDS" });
  }

  if (!Array.isArray(zipEntries) || zipEntries.length < 2 || zipEntries.length > 3) {
    return res.status(400).json({ success: false, error: "Provide 2 or 3 ZIP code entries to compare", code: "INVALID_LOCATIONS" });
  }

  // Each entry: { zip: "78701", label: "Austin, TX" }
  const validEntries = zipEntries.filter(
    (e: { zip: string; label: string }) => e && /^\d{5}$/.test(String(e.zip ?? "").trim())
  );
  if (validEntries.length < 2) {
    return res.status(400).json({ success: false, error: "At least 2 valid 5-digit ZIP codes required", code: "INVALID_LOCATIONS" });
  }

  // Run all location analyses in parallel
  const results = await Promise.all(
    validEntries.map((e: { zip: string; label: string }) =>
      analyzeLocation(String(businessBrief), String(e.label || "").trim(), String(e.zip).trim())
    ),
  );

  const winner = results.reduce((best, r) => (r.feasibility_score > best.feasibility_score ? r : best), results[0]);

  return res.status(200).json({
    success: true,
    data: {
      businessBrief: String(businessBrief).trim(),
      businessType: String(businessType),
      budget: String(budget),
      locations: results,
      winner: winner.location,
    },
  });
}
