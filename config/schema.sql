CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  descripcion TEXT,
  precio INTEGER NOT NULL,              -- en cèntims (ex: 3500 = 35,00 €)
  aforo_total INTEGER NOT NULL,
  fecha_limite_compra TEXT NOT NULL,    -- ISO 8601
  estado TEXT NOT NULL DEFAULT 'abierto', -- abierto | cerrado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Traducció automàtica del títol (vegeu utils/traduccio.js): "nombre" es
-- manté sempre en català (idioma en què el crea el personal), i aquestes
-- dues es generen soles en crear/editar l'esdeveniment.
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS nombre_es TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS nombre_en TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS descripcion_es TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS descripcion_en TEXT;

-- Camps informatius que introdueix l'admin a la fitxa de l'esdeveniment
-- (no els respon el comprador al formulari de compra).
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS nombre_invitado TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cargo_invitado TEXT;

CREATE TABLE IF NOT EXISTS compras (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id),
  nombre_comprador TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  cantidad INTEGER NOT NULL,
  importe_total INTEGER NOT NULL,       -- en cèntims
  quiere_factura BOOLEAN NOT NULL DEFAULT false,
  nif TEXT,
  nombre_fiscal TEXT,
  direccion_fiscal TEXT,
  stripe_checkout_session_id TEXT,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagado | cancelado | reembolsado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_evento ON compras(evento_id);
CREATE INDEX IF NOT EXISTS idx_compras_session ON compras(stripe_checkout_session_id);

-- L'app es connecta sempre via Postgres directe (usuari amb privilegis, no
-- subjecte a RLS): activar-ho aquí només bloqueja l'accés públic accidental
-- via l'API REST autogenerada de Supabase (PostgREST/anon key).
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
