"""
POST /api/v1/optimize-brief

Accepts a raw business brief + optional business type, returns an AI-enhanced
version optimized for market research report quality.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies.auth import verify_api_key
from app.services.ai_service import _call_claude, AIServiceError

logger = logging.getLogger(__name__)
router = APIRouter()


class OptimizeBriefRequest(BaseModel):
    brief: str = Field(..., min_length=5, max_length=2000)
    business_type: str = Field(default="", max_length=100)


class OptimizeBriefResponse(BaseModel):
    optimized: str


SYSTEM_PROMPT = """You are a market research prompt specialist. Your job is to transform a rough business idea description into a rich, structured brief that will produce the most detailed and actionable market research report possible.

A great brief includes:
- Core concept (what the business does, format/model)
- Target customer (demographics, psychographics, behavior)
- Unique value proposition or differentiator
- Revenue model / pricing approach
- Operating context (size, hours, online/offline, staffing)
- Any seasonal or niche angle

Rules:
- Return ONLY the improved brief text — no labels, headers, or explanations
- Keep it 3–5 sentences, dense with specifics
- Preserve the user's original intent and any location context they mentioned
- Do NOT invent fictional specifics (made-up brand names, exact revenue numbers, addresses)
- Write in declarative style: "A [type] business targeting..."
- Do not start with "Sure" or any preamble"""


@router.post(
    "/optimize-brief",
    response_model=OptimizeBriefResponse,
    summary="Optimize a business brief for better AI report quality",
    dependencies=[Depends(verify_api_key)],
)
async def optimize_brief(body: OptimizeBriefRequest) -> OptimizeBriefResponse:
    business_type_str = f" for a {body.business_type}" if body.business_type else ""
    user_prompt = (
        f"Improve this business brief{business_type_str} market research report:\n\n"
        f'"{body.brief.strip()}"\n\n'
        "Return only the improved brief."
    )

    try:
        optimized = await _call_claude(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            label="optimize-brief",
        )
    except AIServiceError as exc:
        logger.warning(f"AI error during brief optimization: {exc}")
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        )

    return OptimizeBriefResponse(optimized=optimized.strip())
