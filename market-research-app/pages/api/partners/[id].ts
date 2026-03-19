import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { PartnerProfile } from "@/lib/marketplace-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PartnerProfile>>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { id } = req.query as { id: string };

  try {
    const { rows } = await pool.query<PartnerProfile>(
      `SELECT pp.*, u.name AS user_name
       FROM partner_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1 AND pp.is_active = TRUE`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Partner not found" });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[partners/id] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch partner" });
  }
}
