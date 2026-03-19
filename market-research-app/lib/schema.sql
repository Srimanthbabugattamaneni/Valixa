-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum types ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE budget_range AS ENUM (
    'under-10k',
    '10k-50k',
    '50k-250k',
    '250k-1m',
    'over-1m'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Table: research_requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_requests (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_brief  TEXT          NOT NULL,
  location        TEXT          NOT NULL,
  business_type   TEXT          NOT NULL,
  budget          budget_range  NOT NULL,
  status          report_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON research_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON research_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Table: reports ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID          NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE,
  viability_score   SMALLINT      CHECK (viability_score BETWEEN 0 AND 100),
  verdict           TEXT,
  competitor_count  INTEGER,
  market_size       TEXT,
  avg_ticket_price  TEXT,
  summary           JSONB,
  sections          JSONB,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Table: users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_research_requests_created_at ON research_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_request_id ON reports(request_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Marketplace ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name       TEXT        NOT NULL,
  industry            TEXT        NOT NULL,
  location            TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  revenue_range       TEXT        NOT NULL,
  profit_margin       NUMERIC(5,2),
  asking_price        NUMERIC(15,2) NOT NULL,
  assets_included     TEXT,
  employees           INT         NOT NULL DEFAULT 0,
  years_in_operation  INT         NOT NULL,
  reason_for_selling  TEXT,
  ai_valuation        JSONB,
  status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','active','under_offer','sold','withdrawn')),
  views               INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  display_name        TEXT        NOT NULL,
  bio                 TEXT,
  location            TEXT,
  skills              TEXT[]      NOT NULL DEFAULT '{}',
  industry_expertise  TEXT[]      NOT NULL DEFAULT '{}',
  role                TEXT        NOT NULL
                        CHECK (role IN ('technical','operations','investor','marketing','sales','other')),
  capital_available   TEXT,
  preferred_industries TEXT[]     NOT NULL DEFAULT '{}',
  preferred_stage     TEXT        CHECK (preferred_stage IN ('idea','early','growth','established')),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_listings (
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id          UUID        NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS deals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID        NOT NULL REFERENCES marketplace_listings(id),
  buyer_id            UUID        NOT NULL REFERENCES users(id),
  seller_id           UUID        NOT NULL REFERENCES users(id),
  stage               TEXT        NOT NULL DEFAULT 'inquiry'
                        CHECK (stage IN ('inquiry','nda_signed','due_diligence','offer_made','offer_accepted','closed','withdrawn')),
  offer_amount        NUMERIC(15,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_threads (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID        NOT NULL REFERENCES marketplace_listings(id),
  buyer_id            UUID        NOT NULL REFERENCES users(id),
  seller_id           UUID        NOT NULL REFERENCES users(id),
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id, seller_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           UUID        NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id           UUID        NOT NULL REFERENCES users(id),
  content             TEXT        NOT NULL,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Marketplace Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_seller_id   ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status       ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_industry     ON marketplace_listings(industry);
CREATE INDEX IF NOT EXISTS idx_listings_created_at   ON marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_profiles_user ON partner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_buyer_id        ON deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deals_seller_id       ON deals(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id    ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_buyer_id      ON message_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_threads_seller_id     ON message_threads(seller_id);

-- ─── Marketplace Triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at ON marketplace_listings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON partner_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON partner_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON deals;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
