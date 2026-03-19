import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";

export interface ReportSummary {
  id: string;
  business_brief: string;
  location: string;
  business_type: string;
  budget: string;
  status: string;
  feasibility_score: number | null;
  verdict: string | null;
  created_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ReportSummary[]>>
) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });

  const userId = (session.user as { id: string }).id;

  try {
    const { rows } = await pool.query<ReportSummary>(
      `SELECT rr.id, rr.business_brief, rr.location, rr.business_type, rr.budget,
              rr.status, rr.created_at,
              r.viability_score AS feasibility_score, r.verdict
       FROM research_requests rr
       LEFT JOIN reports r ON r.request_id = rr.id
       WHERE rr.user_id = $1
       ORDER BY rr.created_at DESC
       LIMIT 50`,
      [userId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[/api/reports] DB error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch reports" });
  }
}
