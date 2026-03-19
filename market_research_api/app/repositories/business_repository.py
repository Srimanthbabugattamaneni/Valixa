"""
Business Repository

Handles all PostgreSQL queries related to business records and report caching.

Assumes the following table schema (adjust column names to match yours):

    CREATE TABLE businesses (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,          -- the "business_idea" field
        location    TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- Optional: cache generated reports so you don't re-call AI for the same record
    CREATE TABLE reports (
        id              SERIAL PRIMARY KEY,
        business_id     INT REFERENCES businesses(id),
        market_overview         TEXT,
        competitor_analysis     TEXT,
        pricing_insights        TEXT,
        demand_analysis         TEXT,
        risk_analysis           TEXT,
        break_even_estimate     TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    );
"""
import logging
from dataclasses import dataclass
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain models (lightweight — not full ORM)
# ---------------------------------------------------------------------------

@dataclass
class BusinessRecord:
    id: int
    name: str        # maps to business_idea in the AI layer
    location: str


@dataclass
class ReportRecord:
    id: int
    business_id: int
    market_overview: str
    competitor_analysis: str
    pricing_insights: str
    demand_analysis: str
    risk_analysis: str
    break_even_estimate: str


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

async def get_business_by_id(
    db: asyncpg.Connection,
    business_id: int,
) -> Optional[BusinessRecord]:
    """Fetch a single business row by primary key. Returns None if not found."""
    row = await db.fetchrow(
        """
        SELECT id, name, location
        FROM businesses
        WHERE id = $1
        """,
        business_id,
    )
    if row is None:
        return None
    return BusinessRecord(id=row["id"], name=row["name"], location=row["location"])


async def get_cached_report(
    db: asyncpg.Connection,
    business_id: int,
) -> Optional[ReportRecord]:
    """
    Return a previously generated report for this business, if one exists.
    Enables report caching — skips AI calls for repeat requests.
    """
    row = await db.fetchrow(
        """
        SELECT id, business_id,
               market_overview, competitor_analysis, pricing_insights,
               demand_analysis, risk_analysis, break_even_estimate
        FROM reports
        WHERE business_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        business_id,
    )
    if row is None:
        return None
    return ReportRecord(**dict(row))


async def save_report(
    db: asyncpg.Connection,
    business_id: int,
    market_overview: str,
    competitor_analysis: str,
    pricing_insights: str,
    demand_analysis: str,
    risk_analysis: str,
    break_even_estimate: str,
) -> int:
    """Persist a generated report and return its new ID."""
    report_id: int = await db.fetchval(
        """
        INSERT INTO reports (
            business_id,
            market_overview, competitor_analysis, pricing_insights,
            demand_analysis, risk_analysis, break_even_estimate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """,
        business_id,
        market_overview, competitor_analysis, pricing_insights,
        demand_analysis, risk_analysis, break_even_estimate,
    )
    logger.info(f"Report saved: id={report_id} for business_id={business_id}")
    return report_id
