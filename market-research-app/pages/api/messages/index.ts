import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { MessageThread } from "@/lib/marketplace-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MessageThread[] | MessageThread>>
) {
  if (req.method === "GET")  return handleList(req, res);
  if (req.method === "POST") return handleCreate(req, res);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/messages — list threads for current user ───────────────────────
async function handleList(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MessageThread[]>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  try {
    const { rows } = await pool.query<MessageThread>(
      `SELECT
         mt.*,
         ml.business_name  AS listing_name,
         ub.name           AS buyer_name,
         us.name           AS seller_name,
         (SELECT content FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT COUNT(*) FROM messages WHERE thread_id = mt.id AND sender_id != $1 AND read_at IS NULL)::int AS unread_count
       FROM message_threads mt
       JOIN marketplace_listings ml ON ml.id = mt.listing_id
       JOIN users ub ON ub.id = mt.buyer_id
       JOIN users us ON us.id = mt.seller_id
       WHERE mt.buyer_id = $1 OR mt.seller_id = $1
       ORDER BY mt.last_message_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[messages] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch threads" });
  }
}

// ─── POST /api/messages — create or get thread for a listing ─────────────────
async function handleCreate(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MessageThread>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const buyerId = (session.user as { id: string }).id;

  const { listing_id } = req.body as { listing_id: string };
  if (!listing_id) return res.status(400).json({ success: false, error: "listing_id required" });

  try {
    // Get seller from listing
    const { rows: listings } = await pool.query<{ seller_id: string }>(
      `SELECT seller_id FROM marketplace_listings WHERE id = $1`, [listing_id]
    );
    if (!listings[0]) return res.status(404).json({ success: false, error: "Listing not found" });

    const sellerId = listings[0].seller_id;
    if (sellerId === buyerId) {
      return res.status(400).json({ success: false, error: "Cannot message your own listing" });
    }

    // Upsert thread
    const { rows } = await pool.query<MessageThread>(
      `INSERT INTO message_threads (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id, seller_id) DO UPDATE SET listing_id = EXCLUDED.listing_id
       RETURNING *`,
      [listing_id, buyerId, sellerId]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[messages] POST error:", err);
    return res.status(500).json({ success: false, error: "Failed to create thread" });
  }
}
