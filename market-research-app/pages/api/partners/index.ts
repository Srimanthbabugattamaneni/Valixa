import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { PartnerProfile, UpsertPartnerProfileInput } from "@/lib/marketplace-types";

// ── Partner compatibility scoring (port of Python algorithm) ──────────────────

const COMPLEMENTARY_ROLES: Record<string, Set<string>> = {
  technical:   new Set(["operations","marketing","sales","investor"]),
  operations:  new Set(["technical","investor","marketing"]),
  investor:    new Set(["technical","operations","marketing","sales"]),
  marketing:   new Set(["technical","operations","investor"]),
  sales:       new Set(["technical","operations","investor"]),
  other:       new Set(["technical","operations","investor","marketing","sales"]),
};

const CAPITAL_ORDER = ["under-10k","10k-50k","50k-250k","250k-1m","over-1m"];

function capitalIndex(cap: string | null | undefined): number {
  if (!cap) return -1;
  return CAPITAL_ORDER.indexOf(cap);
}

function scoreMatch(seeker: PartnerProfile, candidate: PartnerProfile): [number, string[]] {
  let score = 0;
  const reasons: string[] = [];

  // Industry overlap (30 pts)
  const seekerInd = new Set((seeker.preferred_industries ?? []).map((i) => i.toLowerCase()));
  const candInd   = new Set((candidate.industry_expertise ?? []).map((i) => i.toLowerCase()));
  const indOverlap = [...seekerInd].filter((i) => candInd.has(i));
  if (indOverlap.length) {
    score += Math.min(30, indOverlap.length * 10);
    reasons.push(`Shared industry: ${indOverlap.join(", ")}`);
  }

  // Role complementarity (25 pts)
  const complementary = COMPLEMENTARY_ROLES[seeker.role] ?? new Set();
  if (complementary.has(candidate.role)) {
    score += 25;
    reasons.push(`Complementary roles (${seeker.role} + ${candidate.role})`);
  } else if (candidate.role === seeker.role) {
    score += 10;
    reasons.push(`Same role (${seeker.role})`);
  }

  // Capital (20 pts)
  const seekerCap = capitalIndex(seeker.capital_available);
  const candCap   = capitalIndex(candidate.capital_available);
  if (seekerCap >= 0 && candCap >= 0) {
    const diff = Math.abs(seekerCap - candCap);
    if (diff === 0)      { score += 20; reasons.push("Matching capital range"); }
    else if (diff === 1) { score += 15; reasons.push("Similar capital range"); }
    else if (diff === 2) { score += 8; }
  } else if (candCap >= 2) {
    score += 10;
    reasons.push("Partner brings capital");
  }

  // Skills overlap (15 pts)
  const seekerSkills = new Set((seeker.skills ?? []).map((s) => s.toLowerCase()));
  const candSkills   = new Set((candidate.skills ?? []).map((s) => s.toLowerCase()));
  const skillOverlap = [...seekerSkills].filter((s) => candSkills.has(s));
  if (skillOverlap.length) {
    score += Math.min(15, skillOverlap.length * 5);
    reasons.push(`Shared skills: ${skillOverlap.slice(0,3).join(", ")}`);
  }

  // Location (10 pts)
  if (seeker.location && candidate.location) {
    const sw = new Set(seeker.location.toLowerCase().split(/[\s,]+/));
    const cw = candidate.location.toLowerCase().split(/[\s,]+/);
    if (cw.some((w) => sw.has(w))) {
      score += 10;
      reasons.push(`Same region: ${candidate.location}`);
    }
  }

  if (!reasons.length) reasons.push("General compatibility");
  return [Math.min(100, score), reasons];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PartnerProfile[] | PartnerProfile>>
) {
  if (req.method === "GET")  return handleList(req, res);
  if (req.method === "POST") return handleUpsert(req, res);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/partners ────────────────────────────────────────────────────────
async function handleList(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PartnerProfile[]>>
) {
  const { role, industry, location, match } = req.query;

  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;

  try {
    const { rows } = await pool.query<PartnerProfile>(
      `SELECT pp.*, u.name AS user_name
       FROM partner_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_active = TRUE
       ORDER BY pp.updated_at DESC`
    );

    let results = rows;

    // Filter
    if (role) results = results.filter((p) => p.role === role);
    if (industry) results = results.filter((p) =>
      p.industry_expertise.some((i) => i.toLowerCase().includes((industry as string).toLowerCase()))
    );
    if (location) results = results.filter((p) =>
      p.location?.toLowerCase().includes((location as string).toLowerCase())
    );

    // If match=true and user has a profile, score all against their profile
    if (match === "true" && userId) {
      const seeker = rows.find((p) => p.user_id === userId);
      if (seeker) {
        results = results
          .filter((p) => p.user_id !== userId)
          .map((candidate) => {
            const [score, reasons] = scoreMatch(seeker, candidate);
            return { ...candidate, compatibility_score: score, match_reasons: reasons };
          })
          .sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));
      }
    }

    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error("[partners] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch partners" });
  }
}

// ─── POST /api/partners (upsert) ─────────────────────────────────────────────
async function handleUpsert(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PartnerProfile>>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  const {
    display_name, bio, location, skills, industry_expertise,
    role, capital_available, preferred_industries, preferred_stage,
  } = req.body as UpsertPartnerProfileInput;

  if (!display_name || !role || !skills || !industry_expertise || !preferred_industries) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const validRoles = ["technical","operations","investor","marketing","sales","other"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: "Invalid role" });
  }

  try {
    const { rows } = await pool.query<PartnerProfile>(
      `INSERT INTO partner_profiles
         (user_id, display_name, bio, location, skills, industry_expertise,
          role, capital_available, preferred_industries, preferred_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name        = EXCLUDED.display_name,
         bio                 = EXCLUDED.bio,
         location            = EXCLUDED.location,
         skills              = EXCLUDED.skills,
         industry_expertise  = EXCLUDED.industry_expertise,
         role                = EXCLUDED.role,
         capital_available   = EXCLUDED.capital_available,
         preferred_industries= EXCLUDED.preferred_industries,
         preferred_stage     = EXCLUDED.preferred_stage,
         updated_at          = NOW()
       RETURNING *`,
      [
        userId, display_name, bio ?? null, location ?? null,
        skills, industry_expertise, role,
        capital_available ?? null, preferred_industries, preferred_stage ?? null,
      ]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[partners] POST error:", err);
    return res.status(500).json({ success: false, error: "Failed to save profile" });
  }
}
