import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiResponse, Report } from "@/lib/types";
import pool from "@/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Report>>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, error: "Invalid report ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT rr.id AS request_id, rr.business_brief, rr.location,
              rr.business_type, rr.budget, rr.created_at,
              r.id AS report_id, r.viability_score, r.verdict, r.sections
       FROM research_requests rr
       LEFT JOIN reports r ON r.request_id = rr.id
       WHERE rr.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Report not found", code: "NOT_FOUND" });
    }

    const row = rows[0];

    if (!row.report_id) {
      return res.status(202).json({ success: false, error: "Report is still being generated.", code: "PENDING" });
    }

    // `sections` stores the full FastAPI JSON response
    const ai = row.sections ?? {};
    const score: number = row.viability_score ?? ai.feasibility_score ?? 50;
    const verdict = score >= 70 ? "Feasible" : score >= 45 ? "Risky" : "Not Recommended";

    const report: Report = {
      id: row.request_id,
      createdAt: row.created_at,
      input: {
        businessBrief: row.business_brief,
        zipCode:       ai.zip_code ?? "",
        location:      row.location,
        businessType:  row.business_type,
        budget:        row.budget,
      },
      feasibility_score: score,
      verdict,
      score_cards:            ai.score_cards            ?? [],
      market_overview:        ai.market_overview        ?? "",
      competitor_analysis:    ai.competitor_analysis    ?? "",
      pricing_insights:       ai.pricing_insights       ?? "",
      demand_analysis:        ai.demand_analysis        ?? "",
      risk_analysis:          ai.risk_analysis          ?? "",
      startup_cost_estimate:  ai.startup_cost_estimate  ?? "",
      monthly_operating_cost: ai.monthly_operating_cost ?? "",
      burn_estimate_6m:       ai.burn_estimate_6m       ?? "",
      break_even_estimate:    ai.break_even_estimate    ?? "",
      final_recommendation:   ai.final_recommendation   ?? "",
      setup_checklist:        ai.setup_checklist        ?? [],
      milestones:             ai.milestones             ?? [],
      startup_cost_chart:     ai.startup_cost_chart     ?? [],
      monthly_cost_chart:     ai.monthly_cost_chart     ?? [],
      burn_chart:             ai.burn_chart             ?? [],
      break_even_data: ai.break_even_data ?? {
        monthly_fixed_costs: 0, variable_cost_pct: 0,
        avg_transaction_value: 0, monthly_transactions_needed: 0,
        estimated_months_to_break_even: 0,
      },
      risk_heatmap: ai.risk_heatmap ?? [],
    };

    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    console.error("[/api/report/[id]] DB error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch report", code: "INTERNAL_ERROR" });
  }
}
