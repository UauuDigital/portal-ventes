CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  descripcion TEXT,
  precio INTEGER NOT NULL,              -- en cèntims (ex: 3500 = 35,00 €)
  aforo_total INTEGER NOT NULL,
  fecha_limite_compra TEXT NOT NULL,    -- ISO 8601
  estado TEXT NOT NULL DEFAULT 'abierto', -- abierto | cerrado
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL REFERENCES eventos(id),
  nombre_comprador TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  cantidad INTEGER NOT NULL,
  importe_total INTEGER NOT NULL,       -- en cèntims
  quiere_factura INTEGER NOT NULL DEFAULT 0,
  nif TEXT,
  nombre_fiscal TEXT,
  direccion_fiscal TEXT,
  stripe_checkout_session_id TEXT,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagado | cancelado | reembolsado
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compras_evento ON compras(evento_id);
CREATE INDEX IF NOT EXISTS idx_compras_session ON compras(stripe_checkout_session_id);
