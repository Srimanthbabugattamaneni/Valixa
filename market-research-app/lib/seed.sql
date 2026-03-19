-- ─── Seed Data for Testing ────────────────────────────────────────────────────
-- Run this AFTER schema.sql in your Supabase SQL Editor
-- Passwords are all "Password123!" hashed with bcrypt (cost 10)
-- Hash: $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG

-- ─── Users ────────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, name, password_hash) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'alice@example.com',   'Alice Johnson',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000002', 'bob@example.com',     'Bob Martinez',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000003', 'carol@example.com',   'Carol Lee',       '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000004', 'david@example.com',   'David Patel',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000005', 'emily@example.com',   'Emily Chen',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000006', 'frank@example.com',   'Frank Rivera',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000007', 'grace@example.com',   'Grace Kim',       '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG'),
  ('a0000000-0000-0000-0000-000000000008', 'henry@example.com',   'Henry Nguyen',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uivHd/6zG')
ON CONFLICT (email) DO NOTHING;

-- ─── Marketplace Listings ─────────────────────────────────────────────────────
INSERT INTO marketplace_listings (
  id, seller_id, business_name, industry, location, description,
  revenue_range, profit_margin, asking_price, assets_included,
  employees, years_in_operation, reason_for_selling, ai_valuation, status, views
) VALUES

-- 1. Coffee shop
(
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'The Daily Grind Café',
  'Food & Beverage',
  'Austin, TX',
  'Established neighborhood coffee shop with loyal customer base. Fully equipped kitchen, espresso bar, and 40-seat indoor/outdoor patio. Strong Google ratings (4.8★, 320+ reviews). POS system, recipes, and supplier contracts included.',
  '250k-500k',
  18.5,
  320000,
  'Espresso machines, refrigeration units, POS system, furniture, 2-year lease (transferable), supplier contracts, social media accounts',
  4,
  6,
  'Relocating out of state for family reasons',
  '{
    "estimated_value": 310000,
    "valuation_range": {"low": 280000, "high": 360000},
    "confidence": 82,
    "risk_score": 28,
    "key_value_drivers": ["Strong brand recognition", "Prime location lease", "Trained staff retained", "6 years of operating history"],
    "risk_factors": ["Single-location concentration", "Owner-dependent operations"],
    "comparable_sales": "Similar Austin coffee shops sold for $280k–$380k in 2024",
    "recommendation": "Fair value listing. Good candidate for an owner-operator or small hospitality group."
  }',
  'active',
  142
),

-- 2. E-commerce store
(
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'PetPlush Co.',
  'Retail',
  'Remote (Ships from Dallas, TX)',
  'Profitable Shopify pet accessories brand. 12,000 email subscribers, 8k Instagram followers, repeat customer rate of 42%. Dropship + FBA hybrid model — no warehouse needed. All products, supplier relationships, and brand assets transfer.',
  '100k-250k',
  31.0,
  185000,
  'Shopify store, brand assets, domain, email list (12k), social accounts, supplier agreements, Amazon FBA account, 3 months of inventory',
  1,
  3,
  'Founder pursuing SaaS startup, no time for both',
  '{
    "estimated_value": 195000,
    "valuation_range": {"low": 165000, "high": 220000},
    "confidence": 76,
    "risk_score": 35,
    "key_value_drivers": ["High repeat purchase rate (42%)", "Asset-light model", "Diversified sales channels (Shopify + Amazon)", "Strong email list"],
    "risk_factors": ["Platform dependency risk (Shopify/Amazon)", "Category competition from large retailers"],
    "comparable_sales": "E-commerce pet brands at 2–3x annual profit — comparable to this ask",
    "recommendation": "Reasonably priced. Strong for a digital entrepreneur looking for a cash-flowing side business."
  }',
  'active',
  89
),

-- 3. SaaS tool
(
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000003',
  'InvoiceZap',
  'Technology',
  'Remote',
  'B2B SaaS invoicing tool for freelancers and small agencies. 340 paying subscribers at $29/mo. MRR: $9,860. Churn < 3%/mo. Built on Next.js + Supabase. Minimal maintenance (~5 hrs/week). Full source code and documentation included.',
  '100k-250k',
  72.0,
  210000,
  'Full codebase (GitHub), Stripe subscription data, 340 paying customers, domain, support docs, Vercel deployment',
  1,
  2,
  'Building a new venture, want to sell to a focused operator',
  '{
    "estimated_value": 240000,
    "valuation_range": {"low": 200000, "high": 280000},
    "confidence": 88,
    "risk_score": 22,
    "key_value_drivers": ["Recurring MRR of $9.8k", "Low churn rate (<3%)", "High margins (72%)", "Minimal time requirement"],
    "risk_factors": ["Small customer base (340 users)", "Single founder dependency on roadmap"],
    "comparable_sales": "SaaS businesses at this MRR typically sell for 24–36x MRR ($237k–$355k range)",
    "recommendation": "Underpriced relative to MRR multiples. Strong acquisition target for a solo operator or small fund."
  }',
  'active',
  231
),

-- 4. Fitness studio
(
  'b0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000004',
  'IronCore Fitness',
  'Health & Wellness',
  'Denver, CO',
  'Boutique strength training gym with 280 active members. Month-to-month and annual memberships. 2,200 sq ft facility with all equipment owned outright. 3 part-time coaches. Strong community culture — 60% of members joined through referrals.',
  '250k-500k',
  22.0,
  290000,
  'All gym equipment (squat racks, barbells, platforms, cardio), 3-year lease (transferable), CRM with 280 active members, brand, website',
  4,
  5,
  'Owner moving abroad, not looking to manage remotely',
  NULL,
  'active',
  67
),

-- 5. Tutoring center
(
  'b0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'BrightMind Tutoring Center',
  'Education',
  'Chicago, IL',
  'After-school tutoring center serving K-12 students. 95 enrolled students, average session value $65. Established relationships with 4 local school districts. Fully staffed with 6 part-time tutors. Strong summer revenue. Curriculum materials included.',
  '100k-250k',
  28.0,
  175000,
  'Curriculum library, student CRM (95 active students), classroom furniture, whiteboards, laptop set, lease (2 years remaining)',
  7,
  8,
  'Retirement — owner is 68 and ready to step back',
  NULL,
  'active',
  44
),

-- 6. Landscaping company
(
  'b0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000005',
  'GreenLine Landscaping',
  'Services',
  'Phoenix, AZ',
  'Residential landscaping company with 85 recurring weekly clients. 3 crews, all equipment owned. $420k annual revenue, $95k net. Stable, route-based business ideal for an owner-operator. Crews are willing to stay post-sale.',
  '250k-500k',
  22.6,
  380000,
  '3 trucks, trailers, all landscaping equipment (mowers, trimmers, blowers), client list (85 recurring contracts), brand, phone number',
  9,
  11,
  'Owner is starting a commercial landscaping company and wants to focus there',
  NULL,
  'active',
  58
),

-- 7. Bakery (under offer)
(
  'b0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000006',
  'Sugar & Flour Bakery',
  'Food & Beverage',
  'Portland, OR',
  'Artisan bakery with wholesale accounts at 12 local cafés and a busy retail walk-in. 9 years in business, strong brand recognition. Custom cake orders contribute 30% of revenue. Recipes and wholesale relationships transfer.',
  '100k-250k',
  19.0,
  220000,
  'Commercial kitchen equipment, proofing ovens, refrigeration, POS, recipe book, wholesale contracts (12 accounts), Instagram (8.2k followers)',
  5,
  9,
  'Health reasons — owner needs to step back',
  NULL,
  'under_offer',
  103
),

-- 8. Software dev agency (draft)
(
  'b0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000007',
  'Pixel & Code Agency',
  'Technology',
  'Remote (HQ: Miami, FL)',
  'Boutique web/mobile development agency with 7 retainer clients generating $28k/mo recurring. Team of 5 remote developers (contractors, willing to stay). Strong Figma-to-code workflow. Slack-based PM. 40% revenue from ongoing maintenance contracts.',
  '500k-1m',
  35.0,
  650000,
  'Client contracts (7 retainers), codebase repos, project management tooling, brand, domain, team introductions',
  6,
  4,
  'Founding team wants to pursue a product startup',
  NULL,
  'active',
  195
)

ON CONFLICT (id) DO NOTHING;

-- ─── Partner Profiles ─────────────────────────────────────────────────────────
INSERT INTO partner_profiles (
  id, user_id, display_name, bio, location,
  skills, industry_expertise, role,
  capital_available, preferred_industries, preferred_stage, is_active
) VALUES

(
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'Bob Martinez',
  'Serial entrepreneur with 2 exits in food & beverage. I bring operational know-how, vendor relationships, and hands-on hustle. Looking to co-found or buy into a business in the $200k–$500k range.',
  'Austin, TX',
  ARRAY['Operations', 'Supply Chain', 'Vendor Negotiation', 'Hiring', 'P&L Management'],
  ARRAY['Food & Beverage', 'Retail', 'Hospitality'],
  'operations',
  '250k-1m',
  ARRAY['Food & Beverage', 'Hospitality', 'Retail'],
  'growth',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'Carol Lee',
  'Full-stack engineer (10 yrs) with two SaaS products shipped. I love building developer tools and B2B software. Seeking a business or technical co-founder to go to market with.',
  'San Francisco, CA',
  ARRAY['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'AWS', 'Product Design', 'API Architecture'],
  ARRAY['Technology', 'Education', 'Finance'],
  'technical',
  '50k-250k',
  ARRAY['Technology', 'Education'],
  'idea',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'David Patel',
  'Angel investor and LP in 3 funds. Previously CFO at a logistics startup (acquired 2021). I back operators, not just ideas. Looking to invest $100k–$500k in cash-flowing SMBs or early-stage startups with strong unit economics.',
  'Chicago, IL',
  ARRAY['Financial Modeling', 'Fundraising', 'M&A', 'Due Diligence', 'Board Governance'],
  ARRAY['Technology', 'Finance', 'Real Estate', 'Services'],
  'investor',
  '250k-1m',
  ARRAY['Technology', 'Services', 'Real Estate'],
  'early',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'Emily Chen',
  'Growth marketer with 8 years across DTC and B2B. Scaled two brands past $5M ARR. Expert in paid social, SEO, and email automation. Looking to join a product-led company as a co-founder or head of growth.',
  'New York, NY',
  ARRAY['SEO', 'Paid Social', 'Email Marketing', 'Copywriting', 'A/B Testing', 'Analytics', 'Branding'],
  ARRAY['Retail', 'Technology', 'Health & Wellness', 'Education'],
  'marketing',
  '10k-50k',
  ARRAY['Technology', 'Health & Wellness', 'Retail'],
  'early',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006',
  'Frank Rivera',
  'B2B sales leader with $12M in closed deals across SaaS and professional services. Former VP Sales at two startups. I help early-stage companies build repeatable revenue. Looking for a technical or product co-founder to pair with.',
  'Dallas, TX',
  ARRAY['B2B Sales', 'CRM', 'Sales Ops', 'Cold Outreach', 'Contract Negotiation', 'Partnerships'],
  ARRAY['Technology', 'Services', 'Finance'],
  'sales',
  '50k-250k',
  ARRAY['Technology', 'Services'],
  'early',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007',
  'Grace Kim',
  'Healthcare operator and nurse practitioner turned entrepreneur. Ran a multi-location wellness clinic for 6 years. Looking for capital partners or co-founders in health tech, telehealth, or wellness services.',
  'Seattle, WA',
  ARRAY['Healthcare Ops', 'Compliance', 'Patient Experience', 'Hiring', 'Telehealth', 'Wellness Programs'],
  ARRAY['Health & Wellness', 'Services'],
  'operations',
  '50k-250k',
  ARRAY['Health & Wellness', 'Education'],
  'growth',
  TRUE
),

(
  'c0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000008',
  'Henry Nguyen',
  'Real estate investor (30 doors) and small business buyer. Have acquired 2 service businesses via SBA loan. Comfortable with due diligence, lending, and managing operator teams. Looking for a deal partner or operator co-investor.',
  'Houston, TX',
  ARRAY['Real Estate', 'Business Acquisition', 'SBA Lending', 'Due Diligence', 'Property Management'],
  ARRAY['Real Estate', 'Services', 'Hospitality'],
  'investor',
  'over-1m',
  ARRAY['Real Estate', 'Services', 'Hospitality', 'Food & Beverage'],
  'established',
  TRUE
)

ON CONFLICT (user_id) DO NOTHING;

-- ─── Saved Listings (a few users bookmarked some listings) ────────────────────
INSERT INTO saved_listings (user_id, listing_id) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

-- ─── Deals ────────────────────────────────────────────────────────────────────
INSERT INTO deals (id, listing_id, buyer_id, seller_id, stage, offer_amount, notes) VALUES
(
  'd0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'due_diligence',
  305000,
  'Buyer reviewed financials. Requesting full P&L for last 3 years and lease documents.'
),
(
  'd0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000003',
  'nda_signed',
  NULL,
  'NDA executed. Awaiting access to Stripe dashboard and churn data.'
),
(
  'd0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000006',
  'offer_accepted',
  215000,
  'Offer accepted at $215k. Moving to closing documents with escrow.'
)
ON CONFLICT (id) DO NOTHING;

-- ─── Message Threads + Messages ───────────────────────────────────────────────
INSERT INTO message_threads (id, listing_id, buyer_id, seller_id, last_message_at) VALUES
(
  'e0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT DO NOTHING;

INSERT INTO messages (thread_id, sender_id, content, created_at) VALUES
(
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'Hi Alice, I''m very interested in The Daily Grind. Can you share the last 2 years of revenue and your current monthly lease cost?',
  NOW() - INTERVAL '1 day'
),
(
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Hey Bob! Happy to share. Revenue has been $310k and $335k for the last two years. Lease is $4,200/mo with 2 years remaining and a 5-year renewal option.',
  NOW() - INTERVAL '20 hours'
),
(
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'That''s great. Would you be open to a site visit this Thursday afternoon?',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT DO NOTHING;
