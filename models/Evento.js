const db = require('../config/db');

/**
 * Tanca automàticament els esdeveniments oberts la data límit de compra dels
 * quals ja ha passat. Es crida abans de qualsevol lectura per mantenir
 * l'estat sempre al dia sense necessitat d'una tasca programada.
 */
async function tancarExpirats() {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE eventos SET estado = 'cerrado'
       WHERE estado = 'abierto' AND fecha_limite_compra <= ?`
    )
    .run(now);
}

/**
 * Retorna l'esdeveniment actiu: el que està "abierto" i encara no ha superat
 * la seva data límit de compra. Si n'hi hagués més d'un, es queda amb el que
 * té el termini de compra més proper (més urgent per reservar).
 */
async function getActivo() {
  await tancarExpirats();
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM eventos
       WHERE estado = 'abierto' AND fecha_limite_compra > ?
       ORDER BY fecha_limite_compra ASC
       LIMIT 1`
    )
    .get(now);
}

async function getById(id) {
  await tancarExpirats();
  return db.prepare('SELECT * FROM eventos WHERE id = ?').get(id);
}

async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO eventos (nombre, fecha, descripcion, precio, aforo_total, fecha_limite_compra, estado)
     VALUES (@nombre, @fecha, @descripcion, @precio, @aforo_total, @fecha_limite_compra, @estado)
     RETURNING id`
  );
  const info = await stmt.run({ estado: 'abierto', descripcion: null, ...data });
  return getById(info.lastInsertRowid);
}

async function update(id, data) {
  const actual = await getById(id);
  if (!actual) return null;
  const { nombre, fecha, descripcion, precio, aforo_total, fecha_limite_compra, estado } = {
    ...actual,
    ...data,
  };
  await db
    .prepare(
      `UPDATE eventos SET nombre=@nombre, fecha=@fecha, descripcion=@descripcion, precio=@precio,
         aforo_total=@aforo_total, fecha_limite_compra=@fecha_limite_compra, estado=@estado
       WHERE id=@id`
    )
    .run({ nombre, fecha, descripcion, precio, aforo_total, fecha_limite_compra, estado, id });
  return getById(id);
}

async function listAll() {
  await tancarExpirats();
  return db.prepare('SELECT * FROM eventos ORDER BY fecha DESC').all();
}

async function remove(id) {
  await db.prepare('DELETE FROM eventos WHERE id = ?').run(id);
}

module.exports = { getActivo, getById, create, update, listAll, remove };
