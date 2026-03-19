"""
Pydantic schemas for the /marketplace and /partners endpoints.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# AI Valuation
# ---------------------------------------------------------------------------

class ValuationRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    industry: str
    location: str
    revenue_range: str
    profit_margin: Optional[float] = None
    asking_price: float
    employees: int = 0
    years_in_operation: int
    description: str = Field(..., max_length=2000)
    assets_included: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "business_name": "Austin Brew Co",
                "industry": "Food & Beverage",
                "location": "Austin, TX",
                "revenue_range": "500k-1m",
                "profit_margin": 18.5,
                "asking_price": 650000,
                "employees": 8,
                "years_in_operation": 5,
                "description": "Profitable craft brewery with taproom.",
            }
        }
    }


class ValuationRange(BaseModel):
    low: float
    high: float


class ValuationResponse(BaseModel):
    estimated_value: float
    valuation_range: ValuationRange
    confidence: str       # "High" | "Medium" | "Low"
    risk_score: int       # 0–100
    key_value_drivers: List[str]
    risk_factors: List[str]
    comparable_sales: str
    recommendation: str


# ---------------------------------------------------------------------------
# Partner Matching
# ---------------------------------------------------------------------------

class PartnerMatchRequest(BaseModel):
    user_id: str
    skills: List[str] = Field(default_factory=list)
    industry_expertise: List[str] = Field(default_factory=list)
    role: str
    capital_available: Optional[str] = None
    preferred_industries: List[str] = Field(default_factory=list)
    preferred_stage: Optional[str] = None
    location: Optional[str] = None


class PartnerMatchScore(BaseModel):
    partner_id: str
    user_id: str
    display_name: str
    role: str
    location: Optional[str]
    skills: List[str]
    industry_expertise: List[str]
    capital_available: Optional[str]
    compatibility_score: int      # 0–100
    match_reasons: List[str]


class PartnerMatchResponse(BaseModel):
    matches: List[PartnerMatchScore]
    total: int
