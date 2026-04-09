-- =============================================================
-- UNDERHUSET RESERVATIONS — SUPABASE SCHEMA
-- Ejecutar en: Supabase > SQL Editor > New Query
-- =============================================================

-- TABLAS DE RESTAURANTE
CREATE TABLE tables (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  capacity    INTEGER NOT NULL DEFAULT 4,
  zone        TEXT NOT NULL DEFAULT 'interior',  -- interior | exterior
  is_blocked  BOOLEAN DEFAULT FALSE,             -- bloqueada, no cuenta para capacidad
  is_active   BOOLEAN DEFAULT TRUE,              -- desactivada temporalmente
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RESERVAS
CREATE TABLE reservations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE NOT NULL,
  time        TIME NOT NULL,
  guests      INTEGER NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | seated | early_free | completed | cancelled | no_show
  table_id    UUID REFERENCES tables(id) ON DELETE SET NULL,
  is_manual   BOOLEAN DEFAULT FALSE,
  seated_at   TIMESTAMPTZ,   -- cuando llegó la mesa
  freed_at    TIMESTAMPTZ,   -- cuando liberaron antes (early free)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURACIÓN
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Índices
CREATE INDEX idx_reservations_date   ON reservations(date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_email  ON reservations(email);

-- =============================================================
-- DATOS INICIALES: CONFIGURACIÓN
-- =============================================================
INSERT INTO settings (key, value) VALUES
  ('email_confirmation',  'true'),
  ('email_cancellation',  'true'),
  ('email_reminder',      'true'),
  ('reminder_hours',      '24'),
  ('max_guests_online',   '4'),
  ('restaurant_name',     'Restaurant Underhuset'),
  ('restaurant_email',    'post@underhusetlofoten.com');

-- =============================================================
-- DATOS INICIALES: MESAS
-- 12 interior activas + 2 bloqueadas + 6 exterior
-- =============================================================
INSERT INTO tables (name, capacity, zone, is_blocked, is_active, position) VALUES
  ('Mesa 1',  2, 'interior', FALSE, TRUE,  1),
  ('Mesa 2',  2, 'interior', FALSE, TRUE,  2),
  ('Mesa 3',  4, 'interior', FALSE, TRUE,  3),
  ('Mesa 4',  4, 'interior', FALSE, TRUE,  4),
  ('Mesa 5',  4, 'interior', FALSE, TRUE,  5),
  ('Mesa 6',  4, 'interior', FALSE, TRUE,  6),
  ('Mesa 7',  4, 'interior', FALSE, TRUE,  7),
  ('Mesa 8',  4, 'interior', FALSE, TRUE,  8),
  ('Mesa 9',  6, 'interior', FALSE, TRUE,  9),
  ('Mesa 10', 6, 'interior', FALSE, TRUE,  10),
  ('Mesa 11', 4, 'interior', FALSE, TRUE,  11),
  ('Mesa 12', 4, 'interior', FALSE, TRUE,  12),
  -- Bloqueadas (reserva del restaurante)
  ('Mesa R1', 4, 'interior', TRUE,  TRUE,  13),
  ('Mesa R2', 4, 'interior', TRUE,  TRUE,  14),
  -- Exterior
  ('Ext 1',   4, 'exterior', FALSE, TRUE,  15),
  ('Ext 2',   4, 'exterior', FALSE, TRUE,  16),
  ('Ext 3',   4, 'exterior', FALSE, TRUE,  17),
  ('Ext 4',   4, 'exterior', FALSE, TRUE,  18),
  ('Ext 5',   4, 'exterior', FALSE, TRUE,  19),
  ('Ext 6',   4, 'exterior', FALSE, TRUE,  20);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilitar para que solo tu app pueda leer/escribir
-- =============================================================
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;

-- Política: acceso total con anon key (la app usa anon key)
CREATE POLICY "allow_all_reservations" ON reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tables"       ON tables       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settings"     ON settings     FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
