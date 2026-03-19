"""
POST /api/v1/report/pdf

Runs the full report generation pipeline and returns a downloadable PDF.
Requires the same X-API-Key header as the /analyze endpoint.
"""
import logging
import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.dependencies.auth import verify_api_key
from app.schemas.analyze import AnalyzeRequest
from app.services import ai_service
from app.services.pdf_service import generate_pdf
from app.services.report_generation_service import generate_report
from app.utils.logger import set_log_context

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/report/pdf",
    summary="Generate a PDF market research report",
    description=(
        "Runs the full AI report pipeline for the supplied business idea and "
        "location, then converts the result into a professionally formatted PDF. "
        "Returns the file as an `application/pdf` download."
    ),
    responses={
        200: {"content": {"application/pdf": {}}, "description": "PDF report file."},
        429: {"description": "AI provider rate limit — retry shortly."},
        504: {"description": "AI provider timed out."},
    },
    response_class=StreamingResponse,
)
async def generate_pdf_report(
    payload: AnalyzeRequest,
    _: None = Depends(verify_api_key),
) -> StreamingResponse:
    request_id = str(uuid.uuid4())[:8]
    set_log_context(request_id=request_id)

    logger.info(
        "PDF report request",
        extra={
            "request_id": request_id,
            "business_idea": payload.business_idea,
            "location": payload.location,
        },
    )

    # ── 1. Generate the text report ───────────────────────────────────────
    try:
        report = await generate_report(payload)
    except ai_service.AIRateLimitError as exc:
        logger.warning(f"Rate limit [{request_id}]: {exc}")
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "AI provider rate limit reached. Please retry shortly.")
    except ai_service.AITimeoutError as exc:
        logger.error(f"Timeout [{request_id}]: {exc}")
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT,
                            "AI provider timed out. Please retry.")
    except ai_service.AIServiceError as exc:
        logger.error(f"AI error [{request_id}]: {exc}", exc_info=True)
        raise HTTPException(exc.status_code, str(exc))
    except Exception:
        logger.exception(f"Unexpected error [{request_id}]")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "An unexpected error occurred generating the report.")

    # ── 2. Render to PDF ──────────────────────────────────────────────────
    try:
        pdf_bytes = generate_pdf(report)
    except Exception:
        logger.exception(f"PDF render error [{request_id}]")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Failed to render the PDF report.")

    safe_name = report.business_idea.replace(" ", "_").lower()[:40]
    filename  = f"valixa_{safe_name}_{payload.location.replace(' ', '_').lower()}.pdf"

    logger.info(f"PDF ready [{request_id}]: {len(pdf_bytes):,} bytes → {filename}")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
