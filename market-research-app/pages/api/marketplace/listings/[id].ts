import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { MarketplaceListing, AiValuation } from "@/lib/marketplace-types";

const FASTAPI_BASE = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";
const AI_KEY = process.env.AI_SERVICE_API_KEY ?? "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRes = NextApiResponse<any>;

export default async function handler(req: NextApiRequest, res: AnyRes) {
  const { id } = req.query as { id: string };

  if (req.method === "GET")    return handleGet(req, res, id);
  if (req.method === "PATCH")  return handleUpdate(req, res, id);
  if (req.method === "DELETE") return handleDelete(req, res, id);
  if (req.method === "POST" && req.query.action === "valuate") return handleValuate(req, res, id);
  if (req.method === "POST" && req.query.action === "save")    return handleSave(req, res, id);

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/marketplace/listings/[id] ──────────────────────────────────────
async function handleGet(
  req: NextApiRequest,
  res: AnyRes,
  id: string
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = (session?.user as { id?: string })?.id ?? null;

    const { rows } = await pool.query<MarketplaceListing>(
      `UPDATE marketplace_listings SET views = views + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Listing not found" });

    let listing = rows[0];

    if (userId) {
      const { rows: saved } = await pool.query(
        `SELECT 1 FROM saved_listings WHERE user_id = $1 AND listing_id = $2`,
        [userId, id]
      );
      (listing as MarketplaceListing & { is_saved: boolean }).is_saved = saved.length > 0;
    }

    // Attach seller name
    const { rows: seller } = await pool.query<{ name: string }>(
      `SELECT name FROM users WHERE id = $1`, [listing.seller_id]
    );
    (listing as MarketplaceListing & { seller_name: string }).seller_name = seller[0]?.name ?? "";

    return res.status(200).json({ success: true, data: listing });
  } catch (err) {
    console.error("[listings/[id]] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch listing" });
  }
}

// ─── PATCH /api/marketplace/listings/[id] ────────────────────────────────────
async function handleUpdate(
  req: NextApiRequest,
  res: AnyRes,
  id: string
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  // Verify ownership
  const { rows: own } = await pool.query(
    `SELECT seller_id FROM marketplace_listings WHERE id = $1`, [id]
  );
  if (!own[0]) return res.status(404).json({ success: false, error: "Listing not found" });
  if (own[0].seller_id !== userId) return res.status(403).json({ success: false, error: "Not authorized" });

  const allowed = [
    "business_name","industry","location","description","revenue_range",
    "profit_margin","asking_price","assets_included","employees",
    "years_in_operation","reason_for_selling","status",
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = $${idx++}`);
      values.push(req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ success: false, error: "No valid fields to update" });

  values.push(id);
  const { rows } = await pool.query<MarketplaceListing>(
    `UPDATE marketplace_listings SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  return res.status(200).json({ success: true, data: rows[0] });
}

// ─── DELETE /api/marketplace/listings/[id] ───────────────────────────────────
async function handleDelete(
  req: NextApiRequest,
  res: AnyRes,
  id: string
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  const { rows } = await pool.query(
    `SELECT seller_id FROM marketplace_listings WHERE id = $1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ success: false, error: "Listing not found" });
  if (rows[0].seller_id !== userId) return res.status(403).json({ success: false, error: "Not authorized" });

  await pool.query(`DELETE FROM marketplace_listings WHERE id = $1`, [id]);
  return res.status(200).json({ success: true, data: { deleted: true } });
}

// ─── POST /api/marketplace/listings/[id]?action=valuate ──────────────────────
async function handleValuate(
  req: NextApiRequest,
  res: AnyRes,
  id: string
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });

  const { rows } = await pool.query<MarketplaceListing>(
    `SELECT * FROM marketplace_listings WHERE id = $1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ success: false, error: "Listing not found" });

  const listing = rows[0];

  try {
    const aiRes = await fetch(`${FASTAPI_BASE}/api/v1/marketplace/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": AI_KEY },
      body: JSON.stringify({
        business_name:      listing.business_name,
        industry:           listing.industry,
        location:           listing.location,
        revenue_range:      listing.revenue_range,
        profit_margin:      listing.profit_margin,
        asking_price:       listing.asking_price,
        employees:          listing.employees,
        years_in_operation: listing.years_in_operation,
        description:        listing.description,
        assets_included:    listing.assets_included,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return res.status(aiRes.status).json({ success: false, error: `AI error: ${err}` });
    }

    const valuation: AiValuation = await aiRes.json();

    // Persist valuation on the listing
    await pool.query(
      `UPDATE marketplace_listings SET ai_valuation = $1 WHERE id = $2`,
      [JSON.stringify(valuation), id]
    );

    return res.status(200).json({ success: true, data: valuation });
  } catch (err) {
    console.error("[listings/[id]] valuate error:", err);
    return res.status(500).json({ success: false, error: "Valuation failed" });
  }
}

// ─── POST /api/marketplace/listings/[id]?action=save ─────────────────────────
async function handleSave(
  req: NextApiRequest,
  res: AnyRes,
  id: string
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  const { saved } = req.body as { saved: boolean };

  if (saved) {
    await pool.query(
      `INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, id]
    );
  } else {
    await pool.query(
      `DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2`,
      [userId, id]
    );
  }

  return res.status(200).json({ success: true, data: { saved } });
}
