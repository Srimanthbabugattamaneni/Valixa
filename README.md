# Valixa — Validate Your Idea

> AI-powered market research platform for entrepreneurs, founders, and investors.

Valixa turns a rough business idea into a structured market research report in minutes — with competitor analysis, demographic insights, pricing benchmarks, financial projections, and a viability score. It also includes a business marketplace and a co-founder/partner matching network.

---

## Screenshots

### Landing Page
![Landing Page](docs/screenshots/landing.png)

### Market Analysis Form
![Analyze Page](docs/screenshots/analyze.png)

### Generated Report
![Report](docs/screenshots/report.png)

### Business Marketplace
![Marketplace](docs/screenshots/marketplace.png)

### Find Partners
![Partners](docs/screenshots/partners.png)

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

---

## What It Does

### 1. AI Market Research Reports
Enter your business idea, location, and budget — Valixa runs parallel AI analysis using Claude (Anthropic) and returns a full report covering:

- **Market Overview** — market size, growth rate, demand signals
- **Competitor Analysis** — nearby competitors, density, positioning gaps
- **Demographics** — target customer profile, income levels, foot traffic
- **Pricing Benchmarks** — average ticket price, margin ranges
- **Financial Projections** — revenue estimates, break-even timeline
- **Feasibility Score** — 0–100 viability rating with a Feasible / Risky / Not Viable verdict

### 2. Location Comparison
Run the same business idea across 2–3 cities side by side to find the best market fit before committing.

### 3. Business Marketplace
Browse verified businesses for sale or list your own. Each listing includes market data and a viability score so buyers can evaluate opportunities with real intelligence, not just asking price.

### 4. Partner Matching
Find co-founders, investors, operators, and marketers looking for their next opportunity. Filter by role, location, and available capital. Message directly — no middlemen.

### 5. Reports Dashboard
All your past analyses in one place — searchable, filterable by business type, with status tracking for each report.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (Python), Uvicorn, Gunicorn |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Database | PostgreSQL via Supabase (asyncpg) |
| Auth | NextAuth.js v4 — Google OAuth |
| PDF Export | ReportLab |
| Styling | Glassmorphism dark theme, custom CSS utilities |

---

## Project Structure

```
valixa/
├── market-research-app/        # Next.js frontend
│   ├── pages/                  # All routes (App Router + API routes)
│   │   ├── api/                # Server-side API proxies → FastAPI
│   │   ├── analyze.tsx         # Business idea submission form
│   │   ├── dashboard.tsx       # User dashboard
│   │   ├── reports/            # Report list + individual report view
│   │   ├── marketplace/        # Business listings
│   │   ├── partners/           # Partner profiles
│   │   ├── compare.tsx         # Location comparison tool
│   │   └── messages/           # Messaging between users
│   ├── components/             # Navbar, AppShell, Auth, Layout
│   ├── config/                 # Routes, site config
│   ├── lib/                    # DB client, types, schema
│   └── styles/globals.css      # Design tokens + glassmorphism utilities
│
└── market_research_api/        # FastAPI backend
    ├── app/
    │   ├── routes/             # /analyze, /pdf, /marketplace, /optimize-brief
    │   ├── services/           # AI service, PDF generation, data collection
    │   ├── schemas/            # Pydantic request/response models
    │   └── config.py           # Settings loaded from .env.local
    └── main.py                 # App entry point + middleware
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (or a Supabase project)
- Anthropic API key
- Google OAuth credentials

### 1. Clone the repo
```bash
git clone https://github.com/Srimanthbabugattamaneni/Valixa.git
cd Valixa
```

### 2. Frontend setup
```bash
cd market-research-app
npm install
cp .env.example .env.local
# Fill in .env.local with your credentials
npm run dev
```

### 3. Backend setup
```bash
cd market_research_api
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env.local
# Fill in .env.local with your credentials
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Database setup
Run the SQL files in order against your PostgreSQL database:
```bash
# In Supabase SQL editor or psql:
# 1. lib/schema.sql
# 2. lib/migrations/add_user_id_to_requests.sql
# 3. lib/migrations/google_auth.sql
```

### 5. Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `market-research-app/.env.local`

---

## Environment Variables

### `market-research-app/.env.local`
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AI_SERVICE_API_KEY=<shared secret — must match FastAPI>
FASTAPI_BASE_URL=http://localhost:8000
```

### `market_research_api/.env.local`
```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
API_SECRET_KEY=<same as AI_SERVICE_API_KEY above>
AI_MODEL=claude-sonnet-4-6
```

---

## Key Features at a Glance

| Feature | Description |
|---|---|
| AI Report Generation | Full market research in ~60 seconds using Claude |
| Optimize Brief | AI rewrites your rough idea description before analysis |
| Location Comparison | Compare 2–3 cities for the same business idea |
| PDF Export | Download professional PDF version of any report |
| Business Marketplace | Buy and sell validated businesses |
| Partner Network | Find co-founders, investors, and operators |
| Google Sign-In | One-click auth, no password required |
| Dark Glassmorphism UI | Consistent dark theme across all pages |

---
