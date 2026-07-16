const db = require('../config/db');

// Estats que encara ocupen aforament: pagades + pendents que no han expirat
// (les pendents expirades es marquen 'cancelado' des del webhook checkout.session.expired)
const ESTATS_OCUPEN_AFORO = ['pendiente', 'pagado'];

async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO compras (
       evento_id, nombre_comprador, email, telefono, cantidad, importe_total,
       quiere_factura, nif, nombre_fiscal, direccion_fiscal, estado_pago
     ) VALUES (
       @evento_id, @nombre_comprador, @email, @telefono, @cantidad, @importe_total,
       @quiere_factura, @nif, @nombre_fiscal, @direccion_fiscal, 'pendiente'
     ) RETURNING id`
  );
  const info = await stmt.run({
    nif: null,
    nombre_fiscal: null,
    direccion_fiscal: null,
    telefono: null,
    ...data,
    quiere_factura: !!data.quiere_factura,
  });
  return getById(info.lastInsertRowid);
}

async function getById(id) {
  return db.prepare('SELECT * FROM compras WHERE id = ?').get(id);
}

async function findBySessionId(sessionId) {
  return db.prepare('SELECT * FROM compras WHERE stripe_checkout_session_id = ?').get(sessionId);
}

async function setSessionId(id, sessionId) {
  await db.prepare('UPDATE compras SET stripe_checkout_session_id = ? WHERE id = ?').run(sessionId, id);
}

async function marcarPagado(id) {
  await db.prepare("UPDATE compras SET estado_pago = 'pagado' WHERE id = ?").run(id);
}

async function marcarCancelado(id) {
  await db.prepare("UPDATE compras SET estado_pago = 'cancelado' WHERE id = ?").run(id);
}

/** Places ja ocupades (pagades + pendents no expirades) per a un esdeveniment. */
async function cantidadOcupada(eventoId) {
  const placeholders = ESTATS_OCUPEN_AFORO.map(() => '?').join(',');
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM compras
       WHERE evento_id = ? AND estado_pago IN (${placeholders})`
    )
    .get(eventoId, ...ESTATS_OCUPEN_AFORO);
  return Number(row.total);
}

async function listByEvento(eventoId) {
  return db
    .prepare('SELECT * FROM compras WHERE evento_id = ? ORDER BY created_at DESC')
    .all(eventoId);
}

async function eliminarPerEvento(eventoId) {
  await db.prepare('DELETE FROM compras WHERE evento_id = ?').run(eventoId);
}

module.exports = {
  create,
  getById,
  findBySessionId,
  setSessionId,
  marcarPagado,
  marcarCancelado,
  cantidadOcupada,
  listByEvento,
  eliminarPerEvento,
};
