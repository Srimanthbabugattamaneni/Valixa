"""
POST /api/v1/analyze         — direct payload (business_idea + location)
POST /api/v1/analyze/{id}    — lookup business record from PostgreSQL by ID

Both routes run through the same report generation pipeline.
The DB-backed route also caches the result so repeat calls skip the AI entirely.
"""
import logging
import uuid
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.dependencies.auth import verify_api_key
from app.repositories.business_repository import (
    get_business_by_id,
    get_cached_report,
    save_report,
)
from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.services import ai_service
from app.services.report_generation_service import generate_report
from app.utils.logger import set_log_context

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Shared error handler
# ---------------------------------------------------------------------------

def _handle_ai_error(exc: Exception, request_id: str) -> None:
    """Re-raise AI exceptions as the appropriate HTTP errors."""
    if isinstance(exc, ai_service.AIRateLimitError):
        logger.warning(f"Rate limit [{request_id}]: {exc}")
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "AI provider rate limit reached. Please retry shortly.")
    if isinstance(exc, ai_service.AITimeoutError):
        logger.error(f"Timeout [{request_id}]: {exc}")
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT,
                            "AI provider timed out. Please retry.")
    if isinstance(exc, ai_service.AIServiceError):
        logger.error(f"AI error [{request_id}]: {exc}", exc_info=True)
        raise HTTPException(exc.status_code, str(exc))
    logger.exception(f"Unexpected error [{request_id}]")
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                        "An unexpected error occurred.")


# ---------------------------------------------------------------------------
# Route 1 — direct payload  (frontend already has the values)
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate report from direct payload",
    description=(
        "Pass `business_idea` and `location` directly. "
        "Use this when the frontend already holds the values."
    ),
)
async def analyze_direct(
    payload: AnalyzeRequest,
    _: None = Depends(verify_api_key),
) -> AnalyzeResponse:
    request_id = str(uuid.uuid4())[:8]
    set_log_context(request_id=request_id)
    logger.info(
        "Direct analyze request",
        extra={"request_id": request_id, "business_idea": payload.business_idea, "location": payload.location},
    )
    try:
        return await generate_report(payload)
    except Exception as exc:
        _handle_ai_error(exc, request_id)


# ---------------------------------------------------------------------------
# Route 2 — DB-backed lookup  (frontend sends only the record ID)
# ---------------------------------------------------------------------------

@router.post(
    "/analyze/{business_id}",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate report by business ID (reads from PostgreSQL)",
    description=(
        "Pass a `business_id` (primary key in your `businesses` table). "
        "The backend fetches `name` and `location` from PostgreSQL. "
        "If a cached report already exists it is returned immediately — no AI call made."
    ),
    responses={
        200: {"description": "Report returned (generated or cached)."},
        404: {"description": "Business ID not found in the database."},
        429: {"description": "AI provider rate limit. Retry shortly."},
        504: {"description": "AI provider timed out."},
    },
)
async def analyze_by_id(
    business_id: int,
    db: asyncpg.Connection = Depends(get_db),
    use_cache: bool = True,
    _: None = Depends(verify_api_key),
) -> AnalyzeResponse:
    """
    Args:
        business_id: Primary key of the `businesses` table row.
        use_cache:   Set to false (query param) to force a fresh AI report.
                     e.g. POST /api/v1/analyze/42?use_cache=false
    """
    request_id = str(uuid.uuid4())[:8]
    set_log_context(request_id=request_id)

    # 1. Fetch business record
    business = await get_business_by_id(db, business_id)
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with id={business_id} not found.",
        )

    logger.info(
        "DB-backed analyze request",
        extra={"request_id": request_id, "business_id": business_id,
               "name": business.name, "location": business.location},
    )

    # 2. Return cached report if available
    if use_cache:
        cached = await get_cached_report(db, business_id)
        if cached:
            logger.info(f"Returning cached report for business_id={business_id}")
            return AnalyzeResponse(
                business_idea=business.name,
                location=business.location,
                market_overview=cached.market_overview,
                competitor_analysis=cached.competitor_analysis,
                pricing_insights=cached.pricing_insights,
                demand_analysis=cached.demand_analysis,
                risk_analysis=cached.risk_analysis,
                break_even_estimate=cached.break_even_estimate,
            )

    # 3. Generate fresh report
    req = AnalyzeRequest(business_idea=business.name, location=business.location)
    try:
        report = await generate_report(req)
    except Exception as exc:
        _handle_ai_error(exc, request_id)

    # 4. Persist to DB for future cache hits
    await save_report(
        db=db,
        business_id=business_id,
        market_overview=report.market_overview,
        competitor_analysis=report.competitor_analysis,
        pricing_insights=report.pricing_insights,
        demand_analysis=report.demand_analysis,
        risk_analysis=report.risk_analysis,
        break_even_estimate=report.break_even_estimate,
    )

    return report
