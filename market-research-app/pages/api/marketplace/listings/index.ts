import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { MarketplaceListing, CreateListingInput } from "@/lib/marketplace-types";

const VALID_INDUSTRIES = [
  "Food & Beverage", "Retail", "Technology", "Health & Wellness",
  "Education", "Services", "Real Estate", "Manufacturing",
  "Hospitality", "Finance", "Other",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MarketplaceListing[] | MarketplaceListing>>
) {
  if (req.method === "GET") {
    return handleList(req, res);
  }
  if (req.method === "POST") {
    return handleCreate(req, res);
  }
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/marketplace/listings ───────────────────────────────────────────
async function handleList(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MarketplaceListing[]>>
) {
  const { industry, location, min_price, max_price, status = "active", limit = "20", offset = "0" } = req.query;

  const conditions: string[] = ["ml.status = $1"];
  const params: unknown[] = [status];
  let idx = 2;

  if (industry) {
    conditions.push(`ml.industry = $${idx++}`);
    params.push(industry);
  }
  if (location) {
    conditions.push(`ml.location ILIKE $${idx++}`);
    params.push(`%${location}%`);
  }
  if (min_price) {
    conditions.push(`ml.asking_price >= $${idx++}`);
    params.push(Number(min_price));
  }
  if (max_price) {
    conditions.push(`ml.asking_price <= $${idx++}`);
    params.push(Number(max_price));
  }

  params.push(Number(limit));
  params.push(Number(offset));

  const where = conditions.join(" AND ");

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = (session?.user as { id?: string })?.id ?? null;

    const { rows } = await pool.query<MarketplaceListing & { seller_name: string }>(
      `SELECT
         ml.*,
         u.name AS seller_name
         ${userId ? `, (sl.user_id IS NOT NULL) AS is_saved` : `, FALSE AS is_saved`}
       FROM marketplace_listings ml
       JOIN users u ON u.id = ml.seller_id
       ${userId ? `LEFT JOIN saved_listings sl ON sl.listing_id = ml.id AND sl.user_id = '${userId}'` : ""}
       WHERE ${where}
       ORDER BY ml.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[listings/index] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch listings" });
  }
}

// ─── POST /api/marketplace/listings ──────────────────────────────────────────
async function handleCreate(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MarketplaceListing>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  const sellerId = (session.user as { id: string }).id;

  const {
    business_name, industry, location, description,
    revenue_range, profit_margin, asking_price,
    assets_included, employees, years_in_operation,
    reason_for_selling, status = "active",
  } = req.body as CreateListingInput;

  if (!business_name || !industry || !location || !description || !revenue_range || !asking_price) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  if (asking_price <= 0 || employees < 0 || years_in_operation < 0) {
    return res.status(400).json({ success: false, error: "Invalid numeric values" });
  }

  try {
    const { rows } = await pool.query<MarketplaceListing>(
      `INSERT INTO marketplace_listings
         (seller_id, business_name, industry, location, description,
          revenue_range, profit_margin, asking_price, assets_included,
          employees, years_in_operation, reason_for_selling, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        sellerId, business_name, industry, location, description,
        revenue_range, profit_margin ?? null, asking_price,
        assets_included ?? null, employees ?? 0, years_in_operation,
        reason_for_selling ?? null, status,
      ]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[listings/index] POST error:", err);
    return res.status(500).json({ success: false, error: "Failed to create listing" });
  }
}
