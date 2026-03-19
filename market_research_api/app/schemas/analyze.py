"""
Pydantic schemas for the /analyze endpoint.
"""
import re
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    business_idea: str = Field(
        ..., min_length=3, max_length=2000,
        description="Short description of the business idea.",
        examples=["coffee shop"],
    )
    location: str = Field(
        ..., min_length=2, max_length=200,
        description="City, region, or state where the business will operate. Auto-resolved from zip_code if provided.",
        examples=["Austin, TX"],
    )
    zip_code: Optional[str] = Field(
        default=None,
        description="5-digit US ZIP code for hyper-local competitor and demographic search.",
        examples=["78701"],
    )

    @field_validator("business_idea", "location", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("zip_code", mode="before")
    @classmethod
    def validate_zip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = str(v).strip()
        if not re.fullmatch(r"\d{5}", v):
            raise ValueError("zip_code must be exactly 5 digits (e.g. '78701')")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "business_idea": "specialty coffee shop",
                "location": "Austin, TX",
                "zip_code": "78701",
            }
        }
    }


# ---------------------------------------------------------------------------
# Structured report sub-types
# ---------------------------------------------------------------------------

class ScoreCard(BaseModel):
    label: str
    score: int          # 0–100
    verdict: str        # "Strong" | "Good" | "Moderate" | "Weak" | "Poor"
    description: str


class ChartItem(BaseModel):
    label: str
    value: float


class BurnPoint(BaseModel):
    month: str
    expenses: float
    fixed_expenses: float
    variable_expenses: float
    revenue: float
    net: float


class BreakEvenData(BaseModel):
    monthly_fixed_costs: float
    variable_cost_pct: float
    avg_transaction_value: float
    monthly_transactions_needed: int
    estimated_months_to_break_even: int


class Milestone(BaseModel):
    month: int
    title: str
    tasks: List[str]


class RiskItem(BaseModel):
    risk: str
    probability: str    # "Low" | "Medium" | "High"
    impact: str         # "Low" | "Medium" | "High"
    mitigation: str


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class AnalyzeResponse(BaseModel):
    business_idea: str
    location: str

    # ── Feasibility score ────────────────────────────────────────────────
    feasibility_score: int = Field(default=50, ge=0, le=100)
    score_cards: List[ScoreCard] = Field(default_factory=list)

    # ── Narrative sections ───────────────────────────────────────────────
    market_overview: str = ""
    competitor_analysis: str = ""
    pricing_insights: str = ""
    demand_analysis: str = ""
    risk_analysis: str = ""
    startup_cost_estimate: str = ""
    monthly_operating_cost: str = ""
    burn_estimate_6m: str = ""
    break_even_estimate: str = ""
    final_recommendation: str = ""

    # ── Action items ─────────────────────────────────────────────────────
    setup_checklist: List[str] = Field(default_factory=list)
    milestones: List[Milestone] = Field(default_factory=list)

    # ── Chart data ───────────────────────────────────────────────────────
    startup_cost_chart: List[ChartItem] = Field(default_factory=list)
    monthly_cost_chart: List[ChartItem] = Field(default_factory=list)
    burn_chart: List[BurnPoint] = Field(default_factory=list)
    break_even_data: BreakEvenData = Field(
        default_factory=lambda: BreakEvenData(
            monthly_fixed_costs=0, variable_cost_pct=0,
            avg_transaction_value=0, monthly_transactions_needed=0,
            estimated_months_to_break_even=0,
        )
    )
    risk_heatmap: List[RiskItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Error response
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    detail: ErrorDetail
