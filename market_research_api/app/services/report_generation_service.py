"""
Report Generation Service.

Flow:
  1. Receives a validated AnalyzeRequest.
  2. Calls DataCollectionService to build a BusinessContext.
  3. Fires TWO parallel Claude calls:
       - Call A: narrative analysis + scoring + action items
       - Call B: financial projections + chart data
  4. Merges the two JSON responses into a fully-populated AnalyzeResponse.

Splitting the report halves the per-call token count (~3-4k each vs ~8k),
keeping each call well under the 90-second network timeout.
"""
import asyncio
import logging
from typing import Any, Dict

from app.schemas.analyze import (
    AnalyzeRequest, AnalyzeResponse,
    ScoreCard, ChartItem, BurnPoint, BreakEvenData, Milestone, RiskItem,
)
from app.services import ai_service
from app.services.data_collection_service import BusinessContext, collect_context

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System prompt (shared by both calls)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a senior market research analyst, small business consultant,
and financial planning advisor with 15+ years of experience.

Your task is to evaluate the feasibility of a local business idea and produce structured,
decision-useful analysis for a founder dashboard.

Rules:
- Be specific: use real numbers, named competitors, and local market data where possible.
- Be honest about uncertainty — flag estimates clearly.
- Write like an investor and operator, not a blogger.
- Do NOT produce vague advice or repeat generic business concepts.
- You MUST respond with valid JSON only — no markdown, no code fences, no preamble.
- Every field in the schema is required. Do not omit any field.
- All monetary values must be plain numbers (no $ signs or commas inside values).
- Text fields should be 2–4 focused paragraphs (no bullet lists inside text fields).
"""


# ---------------------------------------------------------------------------
# Call A: Analysis report (narrative + scoring + action items)
# ---------------------------------------------------------------------------

_ANALYSIS_SCHEMA = """
Return a single JSON object with EXACTLY this structure:
{
  "feasibility_score": <integer 0-100>,
  "score_cards": [
    {"label": "Market Opportunity",    "score": <0-100>, "verdict": "<Strong|Good|Moderate|Weak|Poor>", "description": "<2 sentences>"},
    {"label": "Competition Level",     "score": <0-100>, "verdict": "...", "description": "..."},
    {"label": "Financial Viability",   "score": <0-100>, "verdict": "...", "description": "..."},
    {"label": "Execution Complexity",  "score": <0-100>, "verdict": "...", "description": "..."},
    {"label": "Location Fit",          "score": <0-100>, "verdict": "...", "description": "..."}
  ],
  "market_overview": "<3-paragraph analysis>",
  "competitor_analysis": "<3-paragraph analysis>",
  "pricing_insights": "<3-paragraph analysis>",
  "demand_analysis": "<3-paragraph analysis>",
  "risk_analysis": "<3-paragraph analysis>",
  "final_recommendation": "<1-paragraph go/no-go verdict with key conditions>",
  "setup_checklist": ["<action item>", ...],
  "milestones": [
    {"month": 1,  "title": "<phase name>", "tasks": ["<task>", ...]},
    {"month": 2,  "title": "...", "tasks": [...]},
    {"month": 3,  "title": "...", "tasks": [...]},
    {"month": 6,  "title": "...", "tasks": [...]},
    {"month": 12, "title": "...", "tasks": [...]}
  ],
  "risk_heatmap": [
    {"risk": "<risk name>", "probability": "<Low|Medium|High>", "impact": "<Low|Medium|High>", "mitigation": "<1-2 sentences>"},
    ...
  ]
}
"""


def _build_analysis_prompt(ctx: BusinessContext) -> str:
    return f"""
{ctx.as_prompt_block()}

Analyse this business idea and produce the market analysis, scoring, and action plan sections.

Consider:
- Can this business work in this specific location?
- What is the competitive landscape and demand situation?
- What are the major risks and how can they be mitigated?
- What milestones must be achieved and in what order?

{_ANALYSIS_SCHEMA}
""".strip()


# ---------------------------------------------------------------------------
# Call B: Financial report (cost breakdowns + chart data)
# ---------------------------------------------------------------------------

_FINANCIAL_SCHEMA = """
Return a single JSON object with EXACTLY this structure:
{
  "startup_cost_estimate": "<2-paragraph breakdown>",
  "monthly_operating_cost": "<2-paragraph breakdown>",
  "burn_estimate_6m": "<2-paragraph projection>",
  "break_even_estimate": "<2-paragraph analysis with conservative/base/optimistic scenarios>",
  "startup_cost_chart": [
    {"label": "<cost category>", "value": <number>},
    ...
  ],
  "monthly_cost_chart": [
    {"label": "<cost category>", "value": <number>},
    ...
  ],
  "burn_chart": [
    {"month": "Month 1", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>},
    {"month": "Month 2", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>},
    {"month": "Month 3", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>},
    {"month": "Month 4", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>},
    {"month": "Month 5", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>},
    {"month": "Month 6", "expenses": <number>, "fixed_expenses": <number>, "variable_expenses": <number>, "revenue": <number>, "net": <number>}
  ],
  Note: fixed_expenses = mandatory recurring costs (rent, salaries, insurance, utilities). variable_expenses = flexible/discretionary costs (marketing, supplies, inventory). expenses = fixed_expenses + variable_expenses. net = revenue - expenses.
  "break_even_data": {
    "monthly_fixed_costs": <number>,
    "variable_cost_pct": <number 0-100>,
    "avg_transaction_value": <number>,
    "monthly_transactions_needed": <integer>,
    "estimated_months_to_break_even": <integer>
  }
}
"""


def _build_financial_prompt(ctx: BusinessContext) -> str:
    return f"""
{ctx.as_prompt_block()}

Produce the financial projections and cost analysis for this business idea.

Consider:
- What does realistic startup funding look like? Break it down by category.
- What are the ongoing monthly costs and working capital needs for the first 6 months?
- What does break-even look like under conservative, base, and optimistic assumptions?

{_FINANCIAL_SCHEMA}
""".strip()


# ---------------------------------------------------------------------------
# Helper: safely cast a dict to a dataclass
# ---------------------------------------------------------------------------

def _parse_score_cards(raw: list) -> list:
    return [ScoreCard(**item) for item in (raw or [])]


def _parse_chart_items(raw: list) -> list:
    return [ChartItem(**item) for item in (raw or [])]


def _parse_burn_chart(raw: list) -> list:
    return [BurnPoint(**item) for item in (raw or [])]


def _parse_milestones(raw: list) -> list:
    return [Milestone(**item) for item in (raw or [])]


def _parse_risk_heatmap(raw: list) -> list:
    return [RiskItem(**item) for item in (raw or [])]


def _parse_break_even_data(raw: Dict[str, Any]) -> BreakEvenData:
    return BreakEvenData(**raw)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def generate_report(request: AnalyzeRequest) -> AnalyzeResponse:
    logger.info(
        "Generating report",
        extra={"business_idea": request.business_idea, "location": request.location},
    )

    ctx: BusinessContext = await collect_context(
        request.business_idea,
        request.location,
        zip_code=request.zip_code,
    )

    logger.info("Dispatching parallel analysis + financial calls to Claude")
    analysis_data, financial_data = await asyncio.gather(
        ai_service.generate_json_report(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=_build_analysis_prompt(ctx),
            label="analysis",
        ),
        ai_service.generate_json_report(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=_build_financial_prompt(ctx),
            label="financials",
        ),
    )

    response = AnalyzeResponse(
        business_idea=request.business_idea,
        location=request.location,
        feasibility_score=int(analysis_data.get("feasibility_score", 50)),
        score_cards=_parse_score_cards(analysis_data.get("score_cards", [])),
        market_overview=analysis_data.get("market_overview", ""),
        competitor_analysis=analysis_data.get("competitor_analysis", ""),
        pricing_insights=analysis_data.get("pricing_insights", ""),
        demand_analysis=analysis_data.get("demand_analysis", ""),
        risk_analysis=analysis_data.get("risk_analysis", ""),
        startup_cost_estimate=financial_data.get("startup_cost_estimate", ""),
        monthly_operating_cost=financial_data.get("monthly_operating_cost", ""),
        burn_estimate_6m=financial_data.get("burn_estimate_6m", ""),
        break_even_estimate=financial_data.get("break_even_estimate", ""),
        final_recommendation=analysis_data.get("final_recommendation", ""),
        setup_checklist=analysis_data.get("setup_checklist", []),
        milestones=_parse_milestones(analysis_data.get("milestones", [])),
        startup_cost_chart=_parse_chart_items(financial_data.get("startup_cost_chart", [])),
        monthly_cost_chart=_parse_chart_items(financial_data.get("monthly_cost_chart", [])),
        burn_chart=_parse_burn_chart(financial_data.get("burn_chart", [])),
        break_even_data=_parse_break_even_data(financial_data.get("break_even_data", {
            "monthly_fixed_costs": 0, "variable_cost_pct": 0,
            "avg_transaction_value": 0, "monthly_transactions_needed": 0,
            "estimated_months_to_break_even": 0,
        })),
        risk_heatmap=_parse_risk_heatmap(analysis_data.get("risk_heatmap", [])),
    )

    logger.info(
        "Report generated successfully",
        extra={"business_idea": request.business_idea, "location": request.location},
    )
    return response
