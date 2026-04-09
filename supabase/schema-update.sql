-- =============================================================
-- UNDERHUSET — SCHEMA UPDATE
-- Ejecutar en: Supabase > SQL Editor > New Query
-- =============================================================

-- Add cancel token to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();

-- Waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date           DATE NOT NULL,
  time           TIME NOT NULL,
  guests         INTEGER NOT NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  status         TEXT DEFAULT 'waiting', -- waiting | notified | confirmed | expired
  confirm_token  UUID DEFAULT gen_random_uuid(),
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_waitlist" ON waitlist FOR ALL USING (true) WITH CHECK (true);

-- New settings
INSERT INTO settings (key, value) VALUES
  ('no_show_minutes', '15'),
  ('waitlist_confirm_hours', '2'),
  ('resend_api_key', ''),
  ('resend_from', 'reservations@underhusetlofoten.com'),
  ('app_url', 'http://localhost:5173'),
  ('opening_hours', '{"mon":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"tue":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"wed":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"thu":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"fri":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"sat":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"},"sun":{"open":true,"lunch_from":"12:00","lunch_to":"14:30","dinner_from":"17:00","dinner_to":"21:00"}}')
ON CONFLICT (key) DO NOTHING;

-- =============================================================
-- TABLE GROUPS
-- =============================================================
CREATE TABLE IF NOT EXISTS table_groups (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  table_ids  UUID[] NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  position   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE table_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_table_groups" ON table_groups FOR ALL USING (true) WITH CHECK (true);

-- Add group_id to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES table_groups(id) ON DELETE SET NULL;

-- Partner hotel lists (run this if you haven't already)
INSERT INTO settings (key, value) VALUES
  ('hotels_ingrid', '["The Heart of Reine","Coop","Moskenes"]'),
  ('hotels_marta',  '["Sakrisøy Gjestegård","Retro Rorbuer"]')
ON CONFLICT (key) DO NOTHING;
