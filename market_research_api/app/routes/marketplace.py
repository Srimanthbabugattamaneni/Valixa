"""
Marketplace AI routes.

  POST /api/v1/marketplace/valuate   — AI business valuation
  POST /api/v1/marketplace/match     — Partner compatibility matching
"""
import logging

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.dependencies.auth import verify_api_key
from app.schemas.marketplace import (
    ValuationRequest, ValuationResponse,
    PartnerMatchRequest, PartnerMatchResponse,
)
from app.services.marketplace_service import generate_valuation, match_partners
from app.services.ai_service import AIServiceError, AIRateLimitError, AITimeoutError

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/marketplace/valuate",
    response_model=ValuationResponse,
    summary="AI business valuation",
    dependencies=[Depends(verify_api_key)],
)
async def valuate_business(req: ValuationRequest):
    """
    Generate an AI-powered fair market valuation for a business listing.
    Returns estimated value, valuation range, risk score, and recommendation.
    """
    try:
        result = await generate_valuation(req)
        return result
    except AIRateLimitError:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please retry shortly."},
        )
    except AITimeoutError:
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={"detail": "AI valuation timed out. Please retry."},
        )
    except AIServiceError as e:
        logger.error(f"AI valuation error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(e)},
        )


class MatchBatchRequest(BaseModel):
    seeker: PartnerMatchRequest
    candidates: list


@router.post(
    "/marketplace/match",
    response_model=PartnerMatchResponse,
    summary="Partner compatibility matching",
    dependencies=[Depends(verify_api_key)],
)
async def match_business_partners(body: MatchBatchRequest):
    """
    Score a list of partner profile dicts against the seeker's profile.
    The Next.js caller fetches all active profiles from DB and passes them here.
    Returns ranked matches with compatibility scores and reasons.
    """
    result = match_partners(body.seeker, body.candidates)
    return result
