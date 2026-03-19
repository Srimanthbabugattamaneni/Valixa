import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { Deal, DealStage } from "@/lib/marketplace-types";

const VALID_STAGES: DealStage[] = [
  "inquiry","nda_signed","due_diligence","offer_made","offer_accepted","closed","withdrawn",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Deal>>
) {
  if (req.method !== "PATCH") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { id } = req.query as { id: string };

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  const { stage, offer_amount, notes } = req.body as {
    stage?: DealStage;
    offer_amount?: number;
    notes?: string;
  };

  if (stage && !VALID_STAGES.includes(stage)) {
    return res.status(400).json({ success: false, error: "Invalid stage" });
  }

  try {
    // Verify participant
    const { rows: deal } = await pool.query(
      `SELECT * FROM deals WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [id, userId]
    );
    if (!deal[0]) return res.status(404).json({ success: false, error: "Deal not found" });

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (stage)        { updates.push(`stage = $${idx++}`);        values.push(stage); }
    if (offer_amount) { updates.push(`offer_amount = $${idx++}`); values.push(offer_amount); }
    if (notes)        { updates.push(`notes = $${idx++}`);        values.push(notes); }

    if (!updates.length) return res.status(400).json({ success: false, error: "Nothing to update" });

    values.push(id);
    const { rows } = await pool.query<Deal>(
      `UPDATE deals SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[deals/[id]] PATCH error:", err);
    return res.status(500).json({ success: false, error: "Failed to update deal" });
  }
}
