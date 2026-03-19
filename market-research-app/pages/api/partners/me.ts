import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { PartnerProfile } from "@/lib/marketplace-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PartnerProfile | null>>
) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  try {
    const { rows } = await pool.query<PartnerProfile>(
      `SELECT * FROM partner_profiles WHERE user_id = $1`, [userId]
    );
    return res.status(200).json({ success: true, data: rows[0] ?? null });
  } catch (err) {
    console.error("[partners/me] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
}
