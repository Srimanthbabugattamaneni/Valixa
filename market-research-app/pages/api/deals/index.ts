import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { Deal } from "@/lib/marketplace-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Deal[] | Deal>>
) {
  if (req.method === "GET")  return handleList(req, res);
  if (req.method === "POST") return handleCreate(req, res);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/deals — list deals for current user ────────────────────────────
async function handleList(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Deal[]>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  try {
    const { rows } = await pool.query<Deal>(
      `SELECT
         d.*,
         ml.business_name  AS listing_name,
         ub.name           AS buyer_name,
         us.name           AS seller_name
       FROM deals d
       JOIN marketplace_listings ml ON ml.id = d.listing_id
       JOIN users ub ON ub.id = d.buyer_id
       JOIN users us ON us.id = d.seller_id
       WHERE d.buyer_id = $1 OR d.seller_id = $1
       ORDER BY d.updated_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[deals] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch deals" });
  }
}

// ─── POST /api/deals — create a deal (buyer initiates inquiry) ───────────────
async function handleCreate(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Deal>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const buyerId = (session.user as { id: string }).id;

  const { listing_id, offer_amount, notes } = req.body as {
    listing_id: string;
    offer_amount?: number;
    notes?: string;
  };

  if (!listing_id) return res.status(400).json({ success: false, error: "listing_id required" });

  try {
    const { rows: listings } = await pool.query<{ seller_id: string }>(
      `SELECT seller_id FROM marketplace_listings WHERE id = $1 AND status = 'active'`,
      [listing_id]
    );
    if (!listings[0]) return res.status(404).json({ success: false, error: "Active listing not found" });

    const sellerId = listings[0].seller_id;
    if (sellerId === buyerId) return res.status(400).json({ success: false, error: "Cannot create deal on your own listing" });

    const { rows } = await pool.query<Deal>(
      `INSERT INTO deals (listing_id, buyer_id, seller_id, offer_amount, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [listing_id, buyerId, sellerId, offer_amount ?? null, notes ?? null]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[deals] POST error:", err);
    return res.status(500).json({ success: false, error: "Failed to create deal" });
  }
}
