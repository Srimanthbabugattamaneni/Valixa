"""
Market Data Service
===================
Fetches real competitor and demographic data from external APIs.

When a ZIP code is provided the pipeline becomes hyper-local:

  1. ZIP → lat/lng resolution  (zippopotam.us — free, no key)
  2. Google Places API          — competitors within 1 mi of the ZIP centroid
  3. Yelp Fusion API            — competitors anchored on ZIP lat/lng
  4. US Census ACS5 (ZCTA)     — demographics at ZIP-code level (not county)
  5. SerpAPI                   — local organic + local-pack trends for ZIP area

Without a ZIP code every source falls back to city-string based lookups
(backward-compatible with the existing flow).

All five calls run concurrently; any failures degrade gracefully to None.

Public interface:
    data = await collect_market_data(business_idea, location, zip_code="78701")
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------

@dataclass
class Competitor:
    name: str
    rating: Optional[float]
    review_count: int
    price_tier: Optional[str]          # "$" / "$$" / "$$$" / "$$$$" / None
    source: str                        # "google" | "yelp" | "serp_local"
    address: Optional[str] = None


@dataclass
class CompetitorData:
    count: int
    average_rating: float
    price_distribution: Dict[str, int]  # {"$": N, "$$": N, ...}
    top_competitors: List[Competitor]
    search_radius_miles: float = 1.0


@dataclass
class AgeDistribution:
    under_18_pct: float
    age_18_34_pct: float
    age_35_54_pct: float
    age_55_plus_pct: float


@dataclass
class DemographicData:
    geography: str
    population: int
    median_household_income: int
    age_distribution: AgeDistribution
    geography_level: str = "county"   # "zcta" when zip-level data used


@dataclass
class MarketData:
    business_idea: str
    location: str
    zip_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    search_radius_miles: float = 2.0
    competitors: Optional[CompetitorData] = None
    demographics: Optional[DemographicData] = None
    search_trends: List[str] = field(default_factory=list)
    local_listings: List[str] = field(default_factory=list)    # SerpAPI local pack
    data_sources: List[str] = field(default_factory=list)

    def as_prompt_block(self) -> str:
        """Render live market data as a markdown block for AI prompts."""
        lines: List[str] = ["### Live Market Data"]

        if self.zip_code:
            lines.append(
                f"**Search Anchor:** ZIP code {self.zip_code} "
                f"({self.location}) — all competitor data is within "
                f"{self.search_radius_miles:.0f} mile(s) of this ZIP centroid."
            )
        else:
            lines.append(f"**Search Area:** {self.location}")

        if self.competitors:
            c = self.competitors
            lines += [
                f"**Nearby Competitors (≤{c.search_radius_miles:.0f} mi):** {c.count}",
                f"**Average Competitor Rating:** {c.average_rating:.1f} / 5.0",
                f"**Price Distribution:** " + ", ".join(
                    f"{tier}: {n}" for tier, n in c.price_distribution.items() if n > 0
                ),
            ]
            if c.top_competitors:
                top = c.top_competitors[:5]
                lines.append("**Top Competitors:**")
                for comp in top:
                    rating_str = f"{comp.rating:.1f}★" if comp.rating else "N/A"
                    price_str = comp.price_tier or "?"
                    addr_str = f" — {comp.address}" if comp.address else ""
                    lines.append(
                        f"  - {comp.name} — {rating_str}, {price_str} [{comp.source}]{addr_str}"
                    )

        if self.demographics:
            d = self.demographics
            ag = d.age_distribution
            level_note = " (ZIP-level precision)" if d.geography_level == "zcta" else " (county level)"
            lines += [
                f"**Geography:** {d.geography}{level_note}",
                f"**Population:** {d.population:,}",
                f"**Median Household Income:** ${d.median_household_income:,}",
                f"**Age Distribution:** Under 18: {ag.under_18_pct:.1f}%,  "
                f"18–34: {ag.age_18_34_pct:.1f}%,  "
                f"35–54: {ag.age_35_54_pct:.1f}%,  "
                f"55+: {ag.age_55_plus_pct:.1f}%",
            ]

        if self.local_listings:
            lines.append("**Local Business Listings (Google Local Pack):**")
            for listing in self.local_listings[:5]:
                lines.append(f"  - {listing}")

        if self.search_trends:
            lines.append("**Search Trend Signals:**")
            for trend in self.search_trends[:5]:
                lines.append(f"  - {trend}")

        if self.data_sources:
            lines.append(f"*Data sources: {', '.join(self.data_sources)}*")

        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Constants & helpers
# ---------------------------------------------------------------------------

PLACES_TYPE_MAP: Dict[str, str] = {
    "coffee": "cafe", "café": "cafe", "restaurant": "restaurant",
    "bar": "bar", "gym": "gym", "fitness": "gym", "bakery": "bakery",
    "salon": "hair_care", "retail": "store", "pharmacy": "pharmacy",
    "hotel": "lodging", "pizza": "restaurant", "burger": "restaurant",
    "sushi": "restaurant", "taco": "restaurant", "yoga": "gym",
    "pilates": "gym", "nail": "beauty_salon", "spa": "spa",
}

PRICE_LABELS = {1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}

# Census ACS5 variables — ref: api.census.gov/data/2022/acs/acs5/variables.html
_AGE_VARS_MALE_UNDER18 = ["B01001_003E", "B01001_004E", "B01001_005E", "B01001_006E"]
_AGE_VARS_FEM_UNDER18  = ["B01001_027E", "B01001_028E", "B01001_029E", "B01001_030E"]
_AGE_VARS_MALE_18_34   = ["B01001_007E", "B01001_008E", "B01001_009E",
                           "B01001_010E", "B01001_011E", "B01001_012E"]
_AGE_VARS_FEM_18_34    = ["B01001_031E", "B01001_032E", "B01001_033E",
                           "B01001_034E", "B01001_035E", "B01001_036E"]
_AGE_VARS_MALE_35_54   = ["B01001_013E", "B01001_014E", "B01001_015E", "B01001_016E"]
_AGE_VARS_FEM_35_54    = ["B01001_037E", "B01001_038E", "B01001_039E", "B01001_040E"]

_ALL_AGE_VARS = (
    _AGE_VARS_MALE_UNDER18 + _AGE_VARS_FEM_UNDER18
    + _AGE_VARS_MALE_18_34 + _AGE_VARS_FEM_18_34
    + _AGE_VARS_MALE_35_54 + _AGE_VARS_FEM_35_54
)
_CENSUS_VARS = ["NAME", "B01003_001E", "B19013_001E"] + _ALL_AGE_VARS


def _places_type(business_idea: str) -> str:
    idea_lower = business_idea.lower()
    for keyword, places_type in PLACES_TYPE_MAP.items():
        if keyword in idea_lower:
            return places_type
    return "establishment"


# Hardcoded state FIPS — still used for county-level fallback
STATE_FIPS: Dict[str, str] = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
    "CO": "08", "CT": "09", "DE": "10", "DC": "11", "FL": "12",
    "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18",
    "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
    "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
    "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
    "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
    "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
    "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49",
    "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
    "WY": "56",
}


def _extract_state_abbr(location: str) -> Optional[str]:
    state_names = {
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
        "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
        "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
        "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
        "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
        "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
        "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
        "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
        "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
        "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
        "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
    }
    match = re.search(r",\s*([A-Z]{2})\b", location)
    if match and match.group(1) in STATE_FIPS:
        return match.group(1)
    loc_lower = location.lower()
    for name, abbr in state_names.items():
        if name in loc_lower:
            return abbr
    return None


def _extract_city(location: str) -> str:
    parts = [p.strip() for p in location.split(",")]
    return parts[0] if parts else location


def _parse_census_age_rows(headers: List[str], values: List[str]) -> DemographicData:
    """Shared Census row parser used by both ZCTA and county fetchers."""
    row: Dict[str, Any] = dict(zip(headers, values))

    def _int(key: str) -> int:
        try:
            v = int(row.get(key, 0) or 0)
            return max(v, 0)
        except (ValueError, TypeError):
            return 0

    total_pop  = _int("B01003_001E")
    median_inc = _int("B19013_001E")
    under_18   = sum(_int(v) for v in _AGE_VARS_MALE_UNDER18 + _AGE_VARS_FEM_UNDER18)
    age_18_34  = sum(_int(v) for v in _AGE_VARS_MALE_18_34   + _AGE_VARS_FEM_18_34)
    age_35_54  = sum(_int(v) for v in _AGE_VARS_MALE_35_54   + _AGE_VARS_FEM_35_54)
    age_55_plus = max(total_pop - under_18 - age_18_34 - age_35_54, 0)

    def _pct(n: int) -> float:
        return round((n / total_pop * 100), 1) if total_pop > 0 else 0.0

    return total_pop, median_inc, AgeDistribution(
        under_18_pct=_pct(under_18),
        age_18_34_pct=_pct(age_18_34),
        age_35_54_pct=_pct(age_35_54),
        age_55_plus_pct=_pct(age_55_plus),
    )


# ---------------------------------------------------------------------------
# Step 0 — ZIP code resolution (zippopotam.us — free, no API key)
# ---------------------------------------------------------------------------

async def _resolve_zip(
    client: httpx.AsyncClient, zip_code: str
) -> Optional[Dict[str, Any]]:
    """
    Resolve a 5-digit US ZIP code to lat/lng, city, and state via the free
    zippopotam.us API (no key required, CORS-open, very fast).

    Returns:
        {"lat": 30.27, "lng": -97.74, "city": "Austin", "state": "Texas", "state_abbr": "TX"}
    """
    try:
        resp = await client.get(
            f"https://api.zippopotam.us/us/{zip_code}",
            timeout=8.0,
        )
        if resp.status_code == 404:
            logger.warning(f"[MarketData] ZIP {zip_code} not found in zippopotam.us")
            return None
        resp.raise_for_status()
        data = resp.json()
        places = data.get("places", [])
        if not places:
            return None
        place = places[0]
        return {
            "lat":        float(place.get("latitude",  0)),
            "lng":        float(place.get("longitude", 0)),
            "city":       place.get("place name", ""),
            "state":      place.get("state", ""),
            "state_abbr": place.get("state abbreviation", ""),
        }
    except Exception as exc:
        logger.warning(f"[MarketData] ZIP resolution failed for {zip_code}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Step 1 — Google Places: nearby competitor search
# ---------------------------------------------------------------------------

async def _google_geocode(
    client: httpx.AsyncClient, location: str, api_key: str
) -> Optional[Dict[str, float]]:
    """Resolve a location string to lat/lng via Google Geocoding API."""
    try:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": location, "key": api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        geo = results[0]["geometry"]["location"]
        return {"lat": geo["lat"], "lng": geo["lng"]}
    except Exception as exc:
        logger.warning(f"[MarketData] Google geocoding failed: {exc}")
        return None


async def _fetch_google_places(
    business_idea: str,
    location: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_meters: int = 1609,         # 1 mile default for ZIP-anchored search
) -> Optional[List[Competitor]]:
    """
    Search Google Places for nearby competitors.

    When lat/lng are already known (from ZIP resolution), they are used directly
    and no geocoding request is made. Radius is 1 mile (1609 m) for ZIP-anchored
    searches, 2 miles (3219 m) for city-string fallback.
    """
    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        logger.debug("[MarketData] GOOGLE_PLACES_API_KEY not set — skipping Places")
        return None

    async with httpx.AsyncClient() as client:
        if lat is None or lng is None:
            coords = await _google_geocode(client, location, api_key)
            if not coords:
                return None
            lat, lng = coords["lat"], coords["lng"]
            radius_meters = 3219   # wider fallback for city-string geocoding

        place_type = _places_type(business_idea)
        competitors: List[Competitor] = []
        next_page_token: Optional[str] = None

        for _page in range(3):   # max 3 pages × 20 = 60 results
            params: Dict[str, Any] = {
                "location": f"{lat},{lng}",
                "radius": radius_meters,
                "keyword": business_idea,
                "key": api_key,
            }
            if place_type != "establishment":
                params["type"] = place_type
            if next_page_token:
                params = {"pagetoken": next_page_token, "key": api_key}
                await asyncio.sleep(2)  # Google requires a short delay before next-page token is valid

            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params=params,
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                logger.warning(f"[MarketData] Google Places page {_page + 1} failed: {exc}")
                break

            for place in data.get("results", []):
                price_level = place.get("price_level")
                vicinity    = place.get("vicinity")
                competitors.append(Competitor(
                    name=place.get("name", "Unknown"),
                    rating=place.get("rating"),
                    review_count=place.get("user_ratings_total", 0),
                    price_tier=PRICE_LABELS.get(price_level) if price_level is not None else None,
                    source="google",
                    address=vicinity,
                ))

            next_page_token = data.get("next_page_token")
            if not next_page_token:
                break

    logger.info(f"[MarketData] Google Places: {len(competitors)} competitors found")
    return competitors


# ---------------------------------------------------------------------------
# Step 2 — Yelp Fusion: competitor search
# ---------------------------------------------------------------------------

async def _fetch_yelp_competitors(
    business_idea: str,
    location: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_meters: int = 1609,
) -> Optional[List[Competitor]]:
    """
    Search Yelp for businesses matching the idea.

    Prefers lat/lng (from ZIP resolution) over a location string for precision.
    Radius: 1 mile (1609 m) for ZIP-anchored, 2 miles (3219 m) for city fallback.
    """
    api_key = getattr(settings, "YELP_API_KEY", "")
    if not api_key:
        logger.debug("[MarketData] YELP_API_KEY not set — skipping Yelp")
        return None

    try:
        params: Dict[str, Any] = {
            "term":     business_idea,
            "radius":   radius_meters,
            "limit":    50,
            "sort_by":  "rating",
        }
        if lat is not None and lng is not None:
            params["latitude"]  = lat
            params["longitude"] = lng
        else:
            params["location"]  = location
            params["radius"]    = 3219   # wider radius for city-string fallback

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.yelp.com/v3/businesses/search",
                headers={"Authorization": f"Bearer {api_key}"},
                params=params,
                timeout=15.0,
            )
            resp.raise_for_status()
            businesses = resp.json().get("businesses", [])

        competitors = []
        for biz in businesses:
            loc_data = biz.get("location", {})
            addr = ", ".join(filter(None, [
                loc_data.get("address1"),
                loc_data.get("city"),
                loc_data.get("zip_code"),
            ]))
            competitors.append(Competitor(
                name=biz.get("name", "Unknown"),
                rating=biz.get("rating"),
                review_count=biz.get("review_count", 0),
                price_tier=biz.get("price"),
                source="yelp",
                address=addr or None,
            ))
        logger.info(f"[MarketData] Yelp: {len(competitors)} competitors found")
        return competitors

    except Exception as exc:
        logger.warning(f"[MarketData] Yelp search failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# Step 3a — Census ACS5 at ZCTA level (ZIP code → exact neighborhood data)
# ---------------------------------------------------------------------------

async def _fetch_census_zcta(zip_code: str) -> Optional[DemographicData]:
    """
    Fetch Census ACS5 demographics at the ZIP Code Tabulation Area (ZCTA) level.

    This is much more precise than county-level data — it matches the exact
    neighborhood the user is targeting. ZCTAs map almost 1-to-1 with US ZIP codes.

    API endpoint: https://api.census.gov/data/2022/acs/acs5
    Geography:    for=zip+code+tabulation+area:{zip_code}
    """
    census_key = getattr(settings, "CENSUS_API_KEY", "")
    try:
        params: Dict[str, Any] = {
            "get": ",".join(_CENSUS_VARS),
            "for": f"zip code tabulation area:{zip_code}",
        }
        if census_key:
            params["key"] = census_key

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.census.gov/data/2022/acs/acs5",
                params=params,
                timeout=15.0,
            )
            resp.raise_for_status()
            rows = resp.json()

        if len(rows) < 2:
            logger.warning(f"[MarketData] Census ZCTA {zip_code}: no data rows returned")
            return None

        headers, values = rows[0], rows[1]
        total_pop, median_inc, age_dist = _parse_census_age_rows(headers, values)
        geography = dict(zip(headers, values)).get("NAME") or f"ZIP {zip_code}"

        logger.info(
            f"[MarketData] Census ZCTA {zip_code}: pop={total_pop:,}, income=${median_inc:,}"
        )
        return DemographicData(
            geography=geography,
            population=total_pop,
            median_household_income=median_inc,
            age_distribution=age_dist,
            geography_level="zcta",
        )

    except Exception as exc:
        logger.warning(f"[MarketData] Census ZCTA fetch failed for {zip_code}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Step 3b — Census ACS5 at county level (fallback when no ZIP provided)
# ---------------------------------------------------------------------------

async def _geocode_census(
    client: httpx.AsyncClient, city: str, state_abbr: str
) -> Optional[Dict[str, str]]:
    try:
        resp = await client.get(
            "https://geocoding.geo.census.gov/geocoder/geographies/address",
            params={
                "city": city, "state": state_abbr,
                "benchmark": "Public_AR_Current",
                "vintage": "Current_Current",
                "format": "json",
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        counties = (
            data.get("result", {})
                .get("addressMatches", [{}])[0]
                .get("geographies", {})
                .get("Counties", [])
        )
        if not counties:
            return None
        county = counties[0]
        return {
            "state_fips":  county["STATE"],
            "county_fips": county["COUNTY"],
            "county_name": county["NAME"],
        }
    except Exception as exc:
        logger.warning(f"[MarketData] Census geocoding failed: {exc}")
        return None


async def _fetch_census_county(city: str, state_abbr: str) -> Optional[DemographicData]:
    """County-level Census ACS5 — used when no ZIP code is provided."""
    state_fips = STATE_FIPS.get(state_abbr.upper() if state_abbr else "")
    if not state_fips:
        return None
    census_key = getattr(settings, "CENSUS_API_KEY", "")

    async with httpx.AsyncClient() as client:
        geo = await _geocode_census(client, city, state_abbr)
        if not geo:
            logger.warning(f"[MarketData] Could not geocode {city}, {state_abbr} for Census")
            return None

        try:
            params: Dict[str, Any] = {
                "get": ",".join(_CENSUS_VARS),
                "for": f"county:{geo['county_fips']}",
                "in":  f"state:{geo['state_fips']}",
            }
            if census_key:
                params["key"] = census_key

            resp = await client.get(
                "https://api.census.gov/data/2022/acs/acs5",
                params=params,
                timeout=15.0,
            )
            resp.raise_for_status()
            rows = resp.json()
        except Exception as exc:
            logger.warning(f"[MarketData] Census county fetch failed: {exc}")
            return None

    if len(rows) < 2:
        return None

    total_pop, median_inc, age_dist = _parse_census_age_rows(rows[0], rows[1])
    logger.info(
        f"[MarketData] Census county {geo['county_name']}: pop={total_pop:,}, income=${median_inc:,}"
    )
    return DemographicData(
        geography=geo["county_name"],
        population=total_pop,
        median_household_income=median_inc,
        age_distribution=age_dist,
        geography_level="county",
    )


# ---------------------------------------------------------------------------
# Step 4 — SerpAPI: organic search trends + local pack results
# ---------------------------------------------------------------------------

async def _fetch_serp_trends(
    business_idea: str,
    location: str,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state_abbr: Optional[str] = None,
) -> Tuple[List[str], List[str]]:
    """
    Returns (organic_trends, local_listings).

    When a ZIP code is provided:
    - Organic query: "{business} near {zip_code} {city} market trends"
    - Local pack query: "{business} near me" anchored on "{city}, {state}"

    SerpAPI local pack results give us real business names, ratings, and addresses
    from Google's local 3-pack — complementing Google Places data.
    """
    api_key = getattr(settings, "SERP_API_KEY", "")
    if not api_key:
        logger.debug("[MarketData] SERP_API_KEY not set — skipping SERP")
        return [], []

    trends: List[str] = []
    local_listings: List[str] = []
    location_param = f"{city}, {state_abbr}" if city and state_abbr else location

    async with httpx.AsyncClient() as client:
        # ── Organic search trends ─────────────────────────────────────────
        if zip_code and city:
            organic_query = f"{business_idea} near {zip_code} {city} market"
        else:
            organic_query = f"{business_idea} market trends {location}"

        try:
            resp = await client.get(
                "https://serpapi.com/search.json",
                params={
                    "q":        organic_query,
                    "location": location_param,
                    "hl": "en", "gl": "us",
                    "num": 10,
                    "api_key":  api_key,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            for result in data.get("organic_results", [])[:8]:
                snippet = result.get("snippet") or result.get("title", "")
                if snippet:
                    trends.append(snippet[:200])
        except Exception as exc:
            logger.warning(f"[MarketData] SERP organic fetch failed: {exc}")

        # ── Local pack results (only when ZIP context available) ──────────
        if zip_code and city:
            try:
                resp = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "q":        f"{business_idea} near {zip_code}",
                        "location": location_param,
                        "hl": "en", "gl": "us",
                        "api_key":  api_key,
                    },
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
                for biz in data.get("local_results", {}).get("places", [])[:8]:
                    rating   = biz.get("rating")
                    reviews  = biz.get("reviews")
                    name     = biz.get("title", "Unknown")
                    address  = biz.get("address", "")
                    rating_str = f"{rating}★ ({reviews} reviews)" if rating else ""
                    local_listings.append(f"{name} — {rating_str} {address}".strip(" —"))
            except Exception as exc:
                logger.warning(f"[MarketData] SERP local pack fetch failed: {exc}")

    logger.info(
        f"[MarketData] SERP: {len(trends)} organic, {len(local_listings)} local listings"
    )
    return trends, local_listings


# ---------------------------------------------------------------------------
# Merge competitor lists from multiple sources
# ---------------------------------------------------------------------------

def _merge_competitors(
    google_list: Optional[List[Competitor]],
    yelp_list: Optional[List[Competitor]],
    radius_miles: float = 1.0,
) -> Optional[CompetitorData]:
    all_competitors: List[Competitor] = []
    seen_names: set = set()

    for comp in (google_list or []) + (yelp_list or []):
        key = comp.name.lower().strip()
        if key not in seen_names:
            seen_names.add(key)
            all_competitors.append(comp)

    if not all_competitors:
        return None

    ratings = [c.rating for c in all_competitors if c.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    price_dist: Dict[str, int] = {"$": 0, "$$": 0, "$$$": 0, "$$$$": 0, "unknown": 0}
    for comp in all_competitors:
        tier = comp.price_tier if comp.price_tier in price_dist else "unknown"
        price_dist[tier] += 1

    top = sorted(all_competitors, key=lambda c: c.rating or 0, reverse=True)

    return CompetitorData(
        count=len(all_competitors),
        average_rating=avg_rating,
        price_distribution={k: v for k, v in price_dist.items() if v > 0},
        top_competitors=top[:10],
        search_radius_miles=radius_miles,
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def collect_market_data(
    business_idea: str,
    location: str,
    zip_code: Optional[str] = None,
) -> MarketData:
    """
    Fetch real market data from all configured sources concurrently.

    When `zip_code` is provided:
    - ZIP is resolved to lat/lng via zippopotam.us (free, no key)
    - Google Places and Yelp search within 1 mile of the ZIP centroid
    - Census demographics are fetched at ZCTA level (ZIP-exact precision)
    - SerpAPI queries include the ZIP code for hyper-local results

    Without a ZIP code: city-string based fallback (backward compatible).
    """
    logger.info(
        f"[MarketData] Starting collection for '{business_idea}' in '{location}'"
        + (f" ZIP {zip_code}" if zip_code else "")
    )

    lat: Optional[float] = None
    lng: Optional[float] = None
    resolved_city: Optional[str] = None
    resolved_state_abbr: Optional[str] = None
    radius_miles: float = 2.0

    # ── Resolve ZIP to lat/lng ────────────────────────────────────────────────
    if zip_code:
        async with httpx.AsyncClient() as _zc:
            zip_info = await _resolve_zip(_zc, zip_code)
        if zip_info:
            lat              = zip_info["lat"]
            lng              = zip_info["lng"]
            resolved_city    = zip_info["city"]
            resolved_state_abbr = zip_info["state_abbr"]
            radius_miles     = 1.0   # tighter radius for ZIP-anchored search
            # Enrich the location string for AI prompts
            if resolved_city and resolved_state_abbr:
                location = f"{resolved_city}, {resolved_state_abbr} (ZIP {zip_code})"
            logger.info(
                f"[MarketData] ZIP {zip_code} → {resolved_city}, {resolved_state_abbr} "
                f"({lat:.4f}, {lng:.4f})"
            )
        else:
            logger.warning(f"[MarketData] Could not resolve ZIP {zip_code} — falling back to city search")

    radius_meters = int(radius_miles * 1609)

    # ── Fire all data sources concurrently ───────────────────────────────────
    google_task = _fetch_google_places(
        business_idea, location, lat, lng, radius_meters
    )
    yelp_task = _fetch_yelp_competitors(
        business_idea, location, lat, lng, radius_meters
    )

    if zip_code:
        # ZIP code → ZCTA-level demographics (most precise)
        census_task = _fetch_census_zcta(zip_code)
    else:
        # Fall back to county-level demographics
        city       = _extract_city(location)
        state_abbr = _extract_state_abbr(location)
        census_task = (
            _fetch_census_county(city, state_abbr)
            if state_abbr
            else asyncio.sleep(0)   # no-op when state can't be parsed
        )

    serp_task = _fetch_serp_trends(
        business_idea, location, zip_code, resolved_city, resolved_state_abbr
    )

    google_result, yelp_result, census_result, serp_result = await asyncio.gather(
        google_task, yelp_task, census_task, serp_task,
        return_exceptions=True,
    )

    def _safe(result: Any) -> Any:
        if isinstance(result, Exception):
            logger.warning(f"[MarketData] Source raised exception: {result}")
            return None
        return result

    google_comps = _safe(google_result)
    yelp_comps   = _safe(yelp_result)
    demographics = _safe(census_result)
    serp_data    = _safe(serp_result)

    trends, local_listings = (serp_data or ([], []))

    competitors = _merge_competitors(google_comps, yelp_comps, radius_miles)

    sources: List[str] = []
    if google_comps:
        sources.append("Google Places")
    if yelp_comps:
        sources.append("Yelp Fusion")
    if demographics:
        level = getattr(demographics, "geography_level", "county")
        sources.append(f"US Census ACS5 ({'ZCTA/ZIP' if level == 'zcta' else 'county'})")
    if trends or local_listings:
        sources.append("SerpAPI")

    logger.info(
        f"[MarketData] Complete — sources: {sources or ['none (keys not configured)']}, "
        f"competitors: {competitors.count if competitors else 0}, "
        f"demographics: {'yes' if demographics else 'no'}"
    )

    return MarketData(
        business_idea=business_idea,
        location=location,
        zip_code=zip_code,
        latitude=lat,
        longitude=lng,
        search_radius_miles=radius_miles,
        competitors=competitors,
        demographics=demographics,
        search_trends=trends,
        local_listings=local_listings,
        data_sources=sources,
    )
