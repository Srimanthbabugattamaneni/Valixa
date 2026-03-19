ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_research_requests_user_id ON research_requests(user_id);
