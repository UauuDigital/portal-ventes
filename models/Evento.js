const db = require('../config/db');

/**
 * Retorna l'esdeveniment actiu: el que està "abierto" i encara no ha superat
 * la seva data límit de compra. Si n'hi hagués més d'un (no hauria de passar
 * en operativa normal), es queda amb el més proper en el temps.
 */
function getActivo() {
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM eventos
       WHERE estado = 'abierto' AND fecha_limite_compra > ?
       ORDER BY fecha ASC
       LIMIT 1`
    )
    .get(now);
}

function getById(id) {
  return db.prepare('SELECT * FROM eventos WHERE id = ?').get(id);
}

function create(data) {
  const stmt = db.prepare(
    `INSERT INTO eventos (nombre, fecha, descripcion, precio, aforo_total, fecha_limite_compra, estado)
     VALUES (@nombre, @fecha, @descripcion, @precio, @aforo_total, @fecha_limite_compra, @estado)`
  );
  const info = stmt.run({ estado: 'abierto', descripcion: null, ...data });
  return getById(info.lastInsertRowid);
}

function update(id, data) {
  const actual = getById(id);
  if (!actual) return null;
  const merged = { ...actual, ...data, id };
  db.prepare(
    `UPDATE eventos SET nombre=@nombre, fecha=@fecha, descripcion=@descripcion, precio=@precio,
       aforo_total=@aforo_total, fecha_limite_compra=@fecha_limite_compra, estado=@estado
     WHERE id=@id`
  ).run(merged);
  return getById(id);
}

module.exports = { getActivo, getById, create, update };
