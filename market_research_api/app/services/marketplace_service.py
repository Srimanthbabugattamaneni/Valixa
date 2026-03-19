"""
Marketplace Service.

Provides:
  1. AI-generated business valuation via Claude.
  2. Rule-based partner compatibility scoring.
"""
import logging
from typing import Any, Dict, List, Optional

from app.schemas.marketplace import (
    ValuationRequest, ValuationResponse, ValuationRange,
    PartnerMatchRequest, PartnerMatchScore, PartnerMatchResponse,
)
from app.services import ai_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# AI Business Valuation
# ---------------------------------------------------------------------------

_VALUATION_SYSTEM_PROMPT = """You are a certified business broker and M&A advisor with 20 years
of experience valuing small and mid-market businesses.

Rules:
- Use real-world valuation multiples (EBITDA, SDE, revenue multiples) appropriate to the industry.
- Be specific and grounded in current market conditions.
- You MUST respond with valid JSON only — no markdown, no code fences, no preamble.
- All monetary values are plain numbers (no $ signs or commas).
"""

_VALUATION_SCHEMA = """
Return a single JSON object with EXACTLY this structure:
{
  "estimated_value": <number — estimated fair market value>,
  "valuation_range": {"low": <number>, "high": <number>},
  "confidence": "<High|Medium|Low>",
  "risk_score": <integer 0-100, higher = riskier>,
  "key_value_drivers": ["<driver>", ...],
  "risk_factors": ["<risk>", ...],
  "comparable_sales": "<2-3 sentences on comparable business sales in this industry/region>",
  "recommendation": "<1-2 sentences: fair price assessment and go/no-go for the asking price>"
}
"""


async def generate_valuation(req: ValuationRequest) -> ValuationResponse:
    logger.info(f"Generating AI valuation for '{req.business_name}'")

    profit_line = f"- Profit margin: {req.profit_margin}%" if req.profit_margin else ""
    assets_line = f"- Assets included: {req.assets_included}" if req.assets_included else ""

    user_prompt = f"""
Business to value:
- Name: {req.business_name}
- Industry: {req.industry}
- Location: {req.location}
- Annual revenue range: {req.revenue_range}
{profit_line}
- Asking price: {req.asking_price}
- Employees: {req.employees}
- Years in operation: {req.years_in_operation}
- Description: {req.description}
{assets_line}

Provide a fair market valuation for this business.

{_VALUATION_SCHEMA}
""".strip()

    data = await ai_service.generate_json_report(
        system_prompt=_VALUATION_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        label="valuation",
    )

    return ValuationResponse(
        estimated_value=float(data.get("estimated_value", req.asking_price)),
        valuation_range=ValuationRange(**data.get("valuation_range", {"low": 0, "high": 0})),
        confidence=data.get("confidence", "Low"),
        risk_score=int(data.get("risk_score", 50)),
        key_value_drivers=data.get("key_value_drivers", []),
        risk_factors=data.get("risk_factors", []),
        comparable_sales=data.get("comparable_sales", ""),
        recommendation=data.get("recommendation", ""),
    )


# ---------------------------------------------------------------------------
# Partner Compatibility Scoring (rule-based, deterministic)
# ---------------------------------------------------------------------------

# Roles that complement each other (non-symmetric scoring)
_COMPLEMENTARY_ROLES = {
    "technical":    {"operations", "marketing", "sales", "investor"},
    "operations":   {"technical", "investor", "marketing"},
    "investor":     {"technical", "operations", "marketing", "sales"},
    "marketing":    {"technical", "operations", "investor"},
    "sales":        {"technical", "operations", "investor"},
    "other":        {"technical", "operations", "investor", "marketing", "sales"},
}

_CAPITAL_ORDER = ["under-10k", "10k-50k", "50k-250k", "250k-1m", "over-1m"]


def _capital_index(cap: Optional[str]) -> int:
    if not cap:
        return -1
    try:
        return _CAPITAL_ORDER.index(cap)
    except ValueError:
        return -1


def score_partner_match(
    seeker: PartnerMatchRequest,
    candidate: Dict[str, Any],
) -> tuple[int, List[str]]:
    """
    Returns (score 0–100, list of match reason strings).

    Scoring breakdown (100 pts total):
      - Industry overlap:      30 pts
      - Role complementarity:  25 pts
      - Capital availability:  20 pts
      - Skills overlap:        15 pts
      - Location match:        10 pts
    """
    score = 0
    reasons: List[str] = []

    # ── Industry overlap (30 pts) ──────────────────────────────────────────
    seeker_industries = {i.lower() for i in seeker.preferred_industries}
    candidate_industries = {i.lower() for i in (candidate.get("industry_expertise") or [])}
    overlap = seeker_industries & candidate_industries
    if overlap:
        industry_pts = min(30, len(overlap) * 10)
        score += industry_pts
        reasons.append(f"Shared industry focus: {', '.join(overlap)}")

    # ── Role complementarity (25 pts) ──────────────────────────────────────
    candidate_role = candidate.get("role", "other")
    complementary = _COMPLEMENTARY_ROLES.get(seeker.role, set())
    if candidate_role in complementary:
        score += 25
        reasons.append(f"Complementary roles ({seeker.role} + {candidate_role})")
    elif candidate_role == seeker.role and seeker.role != "other":
        score += 10  # same role is ok, just less complementary
        reasons.append(f"Same role ({seeker.role}) — may overlap")

    # ── Capital availability (20 pts) ──────────────────────────────────────
    seeker_cap = _capital_index(seeker.capital_available)
    candidate_cap = _capital_index(candidate.get("capital_available"))
    if seeker_cap >= 0 and candidate_cap >= 0:
        diff = abs(seeker_cap - candidate_cap)
        if diff == 0:
            score += 20
            reasons.append("Matching capital range")
        elif diff == 1:
            score += 15
            reasons.append("Similar capital range")
        elif diff == 2:
            score += 8
    elif candidate_cap >= 2:  # candidate has meaningful capital
        score += 10
        reasons.append("Partner brings capital")

    # ── Skills overlap (15 pts) ────────────────────────────────────────────
    seeker_skills = {s.lower() for s in seeker.skills}
    candidate_skills = {s.lower() for s in (candidate.get("skills") or [])}
    skill_overlap = seeker_skills & candidate_skills
    if skill_overlap:
        skill_pts = min(15, len(skill_overlap) * 5)
        score += skill_pts
        reasons.append(f"Shared skills: {', '.join(list(skill_overlap)[:3])}")

    # ── Location match (10 pts) ────────────────────────────────────────────
    if seeker.location and candidate.get("location"):
        # Simple word-overlap check (city/state names)
        seeker_loc_words = {w.lower().strip(",") for w in seeker.location.split()}
        cand_loc_words = {w.lower().strip(",") for w in candidate["location"].split()}
        if seeker_loc_words & cand_loc_words:
            score += 10
            reasons.append(f"Same region: {candidate['location']}")

    if not reasons:
        reasons.append("General compatibility")

    return min(100, score), reasons


def match_partners(
    seeker: PartnerMatchRequest,
    all_profiles: List[Dict[str, Any]],
    limit: int = 10,
) -> PartnerMatchResponse:
    """Score all candidate profiles against the seeker and return top matches."""
    scored = []
    for profile in all_profiles:
        # Don't match with self
        if str(profile.get("user_id")) == str(seeker.user_id):
            continue
        compat_score, reasons = score_partner_match(seeker, profile)
        if compat_score > 0:
            scored.append(PartnerMatchScore(
                partner_id=str(profile["id"]),
                user_id=str(profile["user_id"]),
                display_name=profile["display_name"],
                role=profile["role"],
                location=profile.get("location"),
                skills=profile.get("skills") or [],
                industry_expertise=profile.get("industry_expertise") or [],
                capital_available=profile.get("capital_available"),
                compatibility_score=compat_score,
                match_reasons=reasons,
            ))

    scored.sort(key=lambda x: x.compatibility_score, reverse=True)
    top = scored[:limit]
    return PartnerMatchResponse(matches=top, total=len(scored))
