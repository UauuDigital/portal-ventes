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

-- OBSOLETO: sustituït per evento_invitados (vegeu més avall, permet més d'un
-- convidat per esdeveniment). Pendent d'eliminar un cop verificat en
-- producció que la migració de dades i el sistema nou funcionen bé.
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
  stripe_checkout_session_id TEXT,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagado | cancelado | reembolsado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_evento ON compras(evento_id);
CREATE INDEX IF NOT EXISTS idx_compras_session ON compras(stripe_checkout_session_id);

-- Constructor de formulari de compra personalitzat per esdeveniment (vegeu
-- docs/superpowers/specs/2026-08-18-formulari-compra-personalitzat-design.md).
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS campos_formulario JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE compras ADD COLUMN IF NOT EXISTS respuestas_campos JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS edit_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_edit_token ON compras(edit_token) WHERE edit_token IS NOT NULL;

-- Email de confirmació personalitzable per esdeveniment (utils/mailer.js).
-- Buits = es fa servir la plantilla per defecte (comportament actual).
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS email_asunto TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS email_html TEXT;

-- Convidats/ponents de l'esdeveniment: dada informativa que introdueix
-- l'admin (no la respon el comprador), substitueix eventos.nombre_invitado/
-- cargo_invitado de dalt perquè ara n'hi pot haver més d'un. Sempre almenys
-- un (validat a l'admin, no amb una constraint de BD). L'admin edita la
-- llista sencera de cop en desar l'esdeveniment: per això no hi ha CRUD
-- granular per invitat individual, es reemplaça tota la llista cada vegada.
CREATE TABLE IF NOT EXISTS evento_invitados (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_invitados_evento ON evento_invitados(evento_id);

-- Historial/auditoria: registre de creacions, modificacions (manuals o
-- automàtiques), compres, pagaments i cancel·lacions d'entrades. Es
-- consulta des de l'admin (admin i viewer, només lectura).
CREATE TABLE IF NOT EXISTS historial (
  id SERIAL PRIMARY KEY,
  tipus_entitat TEXT NOT NULL,            -- 'evento' | 'compra'
  entitat_id INTEGER,                     -- pot ser NULL (ex: eliminació en bloc de compres)
  evento_id INTEGER,                      -- esdeveniment relacionat, per poder filtrar-hi sempre
  accio TEXT NOT NULL,                    -- 'creacio' | 'compra' | 'modificacio' | 'cancelacio' | 'pagament' | 'eliminacio'
  origen TEXT NOT NULL DEFAULT 'manual',  -- 'manual' (admin) | 'automatic' (sistema) | 'client' (comprador)
  usuari TEXT,
  descripcio TEXT NOT NULL,
  dades_abans JSONB,
  dades_despres JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_evento ON historial(evento_id);
CREATE INDEX IF NOT EXISTS idx_historial_created ON historial(created_at DESC);

-- L'app es connecta sempre via Postgres directe (usuari amb privilegis, no
-- subjecte a RLS): activar-ho aquí només bloqueja l'accés públic accidental
-- via l'API REST autogenerada de Supabase (PostgREST/anon key).
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_invitados ENABLE ROW LEVEL SECURITY;
