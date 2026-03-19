import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import type { ApiResponse } from "@/lib/types";
import pool from "@/lib/db";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY ?? "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ requestId: string }>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { businessBrief, zipCode, location, businessType, budget } = req.body;

  if (!businessBrief || !zipCode || !location || !businessType || !budget) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: businessBrief, zipCode, location, businessType, budget",
      code: "MISSING_FIELDS",
    });
  }

  if (!/^\d{5}$/.test(String(zipCode))) {
    return res.status(400).json({ success: false, error: "zipCode must be exactly 5 digits", code: "INVALID_ZIP" });
  }

  const validBudgets = ["under-10k", "10k-50k", "50k-250k", "250k-1m", "over-1m"];
  if (!validBudgets.includes(budget)) {
    return res.status(400).json({ success: false, error: "Invalid budget value", code: "INVALID_BUDGET" });
  }

  // Resolve optional user id — anonymous requests are allowed
  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;

  // 1. Save request record
  let requestId: string;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO research_requests (business_brief, location, business_type, budget, status, user_id)
       VALUES ($1, $2, $3, $4, 'processing', $5) RETURNING id`,
      [businessBrief.trim(), `${location.trim()} (${zipCode})`, businessType, budget, userId]
    );
    requestId = rows[0].id;
  } catch (err) {
    console.error("[/api/analyze] DB insert error:", err);
    return res.status(500).json({ success: false, error: "Failed to save request. Please try again.", code: "INTERNAL_ERROR" });
  }

  // 2. Call FastAPI AI service
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiReport: Record<string, any>;
  try {
    const aiRes = await fetch(`${FASTAPI_BASE_URL}/api/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": AI_SERVICE_API_KEY },
      body: JSON.stringify({
        business_idea: businessBrief.trim(),
        location:      location.trim(),
        zip_code:      String(zipCode),
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`AI service error ${aiRes.status}: ${await aiRes.text()}`);
    }
    aiReport = await aiRes.json();
  } catch (aiErr) {
    await pool.query(`UPDATE research_requests SET status = 'failed' WHERE id = $1`, [requestId]);
    console.error("[/api/analyze] FastAPI error:", aiErr);
    return res.status(502).json({ success: false, error: "AI report generation failed. Please try again.", code: "AI_ERROR" });
  }

  // 3. Save the full structured report
  try {
    const score = Number(aiReport.feasibility_score ?? 50);
    const verdict = score >= 70 ? "Feasible" : score >= 45 ? "Risky" : "Not Recommended";

    await pool.query(
      `INSERT INTO reports (request_id, viability_score, verdict, sections, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestId,
        score,
        verdict,
        JSON.stringify(aiReport),   // full structured response
        JSON.stringify({ viabilityScore: score }),
      ]
    );

    await pool.query(`UPDATE research_requests SET status = 'completed' WHERE id = $1`, [requestId]);
  } catch (err) {
    console.error("[/api/analyze] DB save report error:", err);
  }

  return res.status(201).json({ success: true, data: { requestId } });
}
