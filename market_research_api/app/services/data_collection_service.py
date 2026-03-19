"""
Data Collection Service

Gathers and structures contextual data about the requested business idea and location
before the AI report is generated.

In a production system this layer would:
  - Query Census / BLS APIs for demographic and economic data.
  - Call Google Places or Yelp for competitor density.
  - Fetch SIC/NAICS industry benchmarks.
  - Pull real-estate pricing feeds for the location.

Here we build a rich, deterministic context object that the report generation
service embeds into every AI prompt — giving the model grounding data rather
than letting it hallucinate figures.
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional


from app.services.market_data_service import MarketData, collect_market_data

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain model
# ---------------------------------------------------------------------------

@dataclass
class BusinessContext:
    """Structured context fed into every AI section prompt."""

    business_idea: str
    location: str

    # Derived / enriched fields populated by the service
    industry_category: str = ""
    typical_startup_cost_range: str = ""
    key_cost_drivers: List[str] = field(default_factory=list)
    typical_revenue_drivers: List[str] = field(default_factory=list)
    regulatory_notes: List[str] = field(default_factory=list)
    local_economic_notes: str = ""
    comparable_market_size: str = ""
    market_data: Optional[MarketData] = None

    def as_prompt_block(self) -> str:
        """Render context as a compact markdown block for inclusion in prompts."""
        lines = [
            f"**Business Idea:** {self.business_idea}",
            f"**Target Location:** {self.location}",
        ]
        if self.industry_category:
            lines.append(f"**Industry Category:** {self.industry_category}")
        if self.typical_startup_cost_range:
            lines.append(f"**Typical Startup Cost Range:** {self.typical_startup_cost_range}")
        if self.key_cost_drivers:
            lines.append(f"**Key Cost Drivers:** {', '.join(self.key_cost_drivers)}")
        if self.typical_revenue_drivers:
            lines.append(f"**Typical Revenue Drivers:** {', '.join(self.typical_revenue_drivers)}")
        if self.comparable_market_size:
            lines.append(f"**Comparable Market Size:** {self.comparable_market_size}")
        if self.local_economic_notes:
            lines.append(f"**Local Economic Context:** {self.local_economic_notes}")
        if self.regulatory_notes:
            lines.append("**Regulatory Considerations:**")
            for note in self.regulatory_notes:
                lines.append(f"  - {note}")
        if self.market_data:
            lines.append("")
            lines.append(self.market_data.as_prompt_block())
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Industry knowledge base
# (Replace / extend with real API calls in production)
# ---------------------------------------------------------------------------

# Maps normalised keywords → richer context
_INDUSTRY_PROFILES: Dict[str, Dict] = {
    "coffee": {
        "industry_category": "Food & Beverage / Specialty Coffee",
        "typical_startup_cost_range": "$80,000 – $300,000",
        "key_cost_drivers": [
            "Commercial lease / build-out", "Espresso machines & equipment",
            "Staff wages", "Coffee bean sourcing", "Licensing & permits",
        ],
        "typical_revenue_drivers": [
            "Espresso drinks", "Drip coffee", "Food / pastry add-ons",
            "Merchandise", "Catering & wholesale beans",
        ],
        "regulatory_notes": [
            "Food handler / food service permit required",
            "Health department inspection mandatory",
            "Signage permits in most municipalities",
        ],
        "comparable_market_size": "U.S. specialty coffee market ~$47B (2024), growing ~5% YoY",
    },
    "restaurant": {
        "industry_category": "Food & Beverage / Restaurant",
        "typical_startup_cost_range": "$175,000 – $750,000",
        "key_cost_drivers": [
            "Lease & fit-out", "Commercial kitchen equipment",
            "Staff (30–35% of revenue)", "Food cost (28–35% of revenue)",
            "Liquor licence (if applicable)",
        ],
        "typical_revenue_drivers": [
            "Dine-in covers", "Takeout / delivery", "Private events", "Catering",
        ],
        "regulatory_notes": [
            "Food service licence", "Fire safety inspection",
            "Liquor licence if serving alcohol", "ADA compliance",
        ],
        "comparable_market_size": "U.S. restaurant industry ~$997B (2023)",
    },
    "gym": {
        "industry_category": "Health & Fitness",
        "typical_startup_cost_range": "$50,000 – $500,000",
        "key_cost_drivers": [
            "Lease", "Fitness equipment", "Staff / trainers",
            "Insurance", "Marketing",
        ],
        "typical_revenue_drivers": [
            "Monthly memberships", "Personal training sessions",
            "Group classes", "Merchandise",
        ],
        "regulatory_notes": [
            "Business licence", "Certificate of occupancy",
            "ADA compliance for accessibility",
        ],
        "comparable_market_size": "U.S. fitness industry ~$35B (2023), recovering post-COVID",
    },
    "saas": {
        "industry_category": "Software / SaaS",
        "typical_startup_cost_range": "$10,000 – $250,000 (MVP stage)",
        "key_cost_drivers": [
            "Engineering salaries", "Cloud infrastructure (AWS / GCP / Azure)",
            "Customer acquisition", "Support tooling",
        ],
        "typical_revenue_drivers": [
            "Monthly / annual subscriptions", "Usage-based pricing",
            "Enterprise licences", "Professional services",
        ],
        "regulatory_notes": [
            "GDPR / CCPA compliance if handling PII",
            "SOC 2 Type II for enterprise sales",
            "Data residency requirements vary by region",
        ],
        "comparable_market_size": "Global SaaS market ~$197B (2023), ~18% CAGR",
    },
    "retail": {
        "industry_category": "Retail",
        "typical_startup_cost_range": "$50,000 – $250,000",
        "key_cost_drivers": [
            "Lease & store fit-out", "Inventory / COGS",
            "Staff wages", "POS system", "Marketing",
        ],
        "typical_revenue_drivers": [
            "In-store sales", "E-commerce channel",
            "Loyalty programmes", "Seasonal promotions",
        ],
        "regulatory_notes": [
            "Retail business licence", "Sales tax collection",
            "Fire safety compliance",
        ],
        "comparable_market_size": "U.S. retail market ~$7.2T (2023)",
    },
}

_DEFAULT_PROFILE: Dict = {
    "industry_category": "General Business / Services",
    "typical_startup_cost_range": "$25,000 – $200,000 (estimate)",
    "key_cost_drivers": ["Rent / overhead", "Labour", "Marketing", "Equipment"],
    "typical_revenue_drivers": ["Core service / product sales", "Repeat customers", "Referrals"],
    "regulatory_notes": [
        "Standard business licence required",
        "Local zoning compliance",
    ],
    "comparable_market_size": "Varies by specific sub-sector",
}

# Location knowledge — approximate economic colour for major US cities
_LOCATION_NOTES: Dict[str, str] = {
    "boston": (
        "Boston has a highly educated, high-income consumer base driven by its large university and "
        "healthcare / biotech ecosystem. Commercial rents in prime areas (Back Bay, Seaport) are "
        "among the highest in the US (~$60–120/sqft NNN). Strong seasonal tourism in summer."
    ),
    "new york": (
        "NYC offers the largest US consumer market but also the highest operating costs — "
        "commercial rents can exceed $200/sqft in Manhattan. Extremely competitive across all verticals."
    ),
    "san francisco": (
        "SF has a tech-affluent consumer base and premium pricing tolerance but has seen "
        "post-pandemic retail softening downtown. High labour costs due to minimum wage floor (~$18/hr)."
    ),
    "austin": (
        "Austin is one of the fastest-growing US metros with a young, tech-forward population. "
        "Relatively lower commercial rents vs. coastal cities and a favourable tax environment (no state income tax)."
    ),
    "chicago": (
        "Chicago is a large, diverse metro with moderate commercial rents outside the Loop. "
        "Strong Midwest logistics hub with a broad middle-class consumer base."
    ),
    "miami": (
        "Miami has a fast-growing population with heavy international influence. "
        "Tourism provides year-round foot traffic; bilingual marketing is often advantageous."
    ),
    "seattle": (
        "Seattle has one of the highest median household incomes in the US (tech boom). "
        "Strong culture of sustainability and local brands; competitive coffee market specifically."
    ),
}


def _match_industry(business_idea: str) -> Dict:
    idea_lower = business_idea.lower()
    for keyword, profile in _INDUSTRY_PROFILES.items():
        if keyword in idea_lower:
            return profile
    return _DEFAULT_PROFILE


def _match_location(location: str) -> str:
    loc_lower = location.lower()
    for city, note in _LOCATION_NOTES.items():
        if city in loc_lower:
            return note
    return (
        f"{location} — detailed local economic data not pre-loaded. "
        "Use Census ACS, BLS, or local chamber of commerce sources for precise figures."
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def collect_context(
    business_idea: str,
    location: str,
    zip_code: Optional[str] = None,
) -> BusinessContext:
    """
    Build a BusinessContext for the given idea and location.

    When zip_code is provided it is forwarded to collect_market_data() which
    performs hyper-local searches (1-mile radius, ZCTA demographics, etc.).
    """
    logger.info(
        f"Collecting context for '{business_idea}' in '{location}'"
        + (f" ZIP {zip_code}" if zip_code else "")
    )

    profile    = _match_industry(business_idea)
    local_note = _match_location(location)
    market_data = await collect_market_data(business_idea, location, zip_code=zip_code)

    # If the zip resolver enriched the location string, use it for the AI context
    enriched_location = market_data.location if market_data.location != location else location

    ctx = BusinessContext(
        business_idea=business_idea,
        location=enriched_location,
        industry_category=profile.get("industry_category", ""),
        typical_startup_cost_range=profile.get("typical_startup_cost_range", ""),
        key_cost_drivers=list(profile.get("key_cost_drivers", [])),
        typical_revenue_drivers=list(profile.get("typical_revenue_drivers", [])),
        regulatory_notes=list(profile.get("regulatory_notes", [])),
        comparable_market_size=profile.get("comparable_market_size", ""),
        local_economic_notes=local_note,
        market_data=market_data,
    )

    logger.debug(
        f"Context built: industry='{ctx.industry_category}', "
        f"sources={market_data.data_sources}, "
        f"zip={'yes' if zip_code else 'no'}"
    )
    return ctx
