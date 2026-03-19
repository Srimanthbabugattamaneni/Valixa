"""
Valixa — FastAPI application entry point.

Run locally:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Production (gunicorn + uvicorn workers):
    gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8000
"""
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_pool, create_pool
from app.routes import analyze, pdf, marketplace, optimize_brief
from app.services.ai_service import close_client
from app.utils.logger import setup_logging

# ---------------------------------------------------------------------------
# Logging — must initialise before any logger is used
# ---------------------------------------------------------------------------
setup_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Starting {settings.APP_NAME}",
        extra={"version": settings.APP_VERSION, "env": settings.ENV},
    )
    await create_pool()          # open PostgreSQL connection pool
    yield
    logger.info("Shutting down — closing connections…")
    await close_client()         # close Anthropic HTTP client
    await close_pool()           # close PostgreSQL pool
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered market research report generator. "
        "Submit a business idea and location; receive a full 6-section report in seconds."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log every request with timing and attach a request-id to headers."""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()

    logger.info(
        f"→ {request.method} {request.url.path}",
        extra={"request_id": request_id, "client": request.client.host if request.client else "unknown"},
    )

    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        f"← {request.method} {request.url.path} [{response.status_code}] {duration_ms:.1f}ms",
        extra={"request_id": request_id, "status_code": response.status_code},
    )

    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return clean 422 error details for Pydantic validation failures."""
    errors = [
        {
            "field": " → ".join(str(loc) for loc in err["loc"]),
            "message": err["msg"],
            "type": err["type"],
        }
        for err in exc.errors()
    ]
    logger.warning(f"Validation error on {request.url.path}: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed.", "errors": errors},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for any unhandled exceptions — never expose internal details."""
    logger.exception(f"Unhandled exception on {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(analyze.router,         prefix="/api/v1", tags=["Market Analysis"])
app.include_router(pdf.router,             prefix="/api/v1", tags=["PDF Reports"])
app.include_router(marketplace.router,     prefix="/api/v1", tags=["Marketplace"])
app.include_router(optimize_brief.router,  prefix="/api/v1", tags=["Utilities"])


# ---------------------------------------------------------------------------
# Utility endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"], summary="Health check")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.ENV,
    }


@app.get("/", include_in_schema=False)
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}. Visit /docs for the API reference."}


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENV == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )
