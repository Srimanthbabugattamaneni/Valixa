"""
Async PostgreSQL connection pool using asyncpg.

Lifecycle:
  - Pool is created on app startup (lifespan).
  - Pool is closed on app shutdown.
  - Use `get_db()` as a FastAPI dependency in any route.

Usage in a route:
    @router.get("/example")
    async def example(db: asyncpg.Connection = Depends(get_db)):
        row = await db.fetchrow("SELECT * FROM businesses WHERE id = $1", record_id)
"""
import logging
from typing import AsyncGenerator

import asyncpg

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level pool — created once at startup
_pool: asyncpg.Pool | None = None


async def create_pool() -> None:
    """Create the global connection pool. Call once in app lifespan startup."""
    global _pool
    logger.info("Creating PostgreSQL connection pool…")
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=30,
        server_settings={"application_name": settings.APP_NAME},
    )
    logger.info("PostgreSQL pool ready.")


async def close_pool() -> None:
    """Gracefully close the pool. Call in app lifespan shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL pool closed.")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    FastAPI dependency — yields a checked-out connection for the duration
    of the request, then returns it to the pool automatically.

    Example:
        async def my_route(db: asyncpg.Connection = Depends(get_db)):
            ...
    """
    if _pool is None:
        raise RuntimeError("Database pool is not initialised. Check startup logs.")
    async with _pool.acquire() as connection:
        yield connection
