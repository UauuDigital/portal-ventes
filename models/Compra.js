const db = require('../config/db');

// Estats que encara ocupen aforament: pagades + pendents que no han expirat
// (les pendents expirades es marquen 'cancelado' des del webhook checkout.session.expired)
const ESTATS_OCUPEN_AFORO = ['pendiente', 'pagado'];

function create(data) {
  const stmt = db.prepare(
    `INSERT INTO compras (
       evento_id, nombre_comprador, email, telefono, cantidad, importe_total,
       quiere_factura, nif, nombre_fiscal, direccion_fiscal, estado_pago
     ) VALUES (
       @evento_id, @nombre_comprador, @email, @telefono, @cantidad, @importe_total,
       @quiere_factura, @nif, @nombre_fiscal, @direccion_fiscal, 'pendiente'
     )`
  );
  const info = stmt.run({
    nif: null,
    nombre_fiscal: null,
    direccion_fiscal: null,
    telefono: null,
    ...data,
    quiere_factura: data.quiere_factura ? 1 : 0,
  });
  return getById(info.lastInsertRowid);
}

function getById(id) {
  return db.prepare('SELECT * FROM compras WHERE id = ?').get(id);
}

function findBySessionId(sessionId) {
  return db.prepare('SELECT * FROM compras WHERE stripe_checkout_session_id = ?').get(sessionId);
}

function setSessionId(id, sessionId) {
  db.prepare('UPDATE compras SET stripe_checkout_session_id = ? WHERE id = ?').run(sessionId, id);
}

function marcarPagado(id) {
  db.prepare("UPDATE compras SET estado_pago = 'pagado' WHERE id = ?").run(id);
}

function marcarCancelado(id) {
  db.prepare("UPDATE compras SET estado_pago = 'cancelado' WHERE id = ?").run(id);
}

/** Places ja ocupades (pagades + pendents no expirades) per a un esdeveniment. */
function cantidadOcupada(eventoId) {
  const placeholders = ESTATS_OCUPEN_AFORO.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM compras
       WHERE evento_id = ? AND estado_pago IN (${placeholders})`
    )
    .get(eventoId, ...ESTATS_OCUPEN_AFORO);
  return row.total;
}

function listByEvento(eventoId) {
  return db
    .prepare('SELECT * FROM compras WHERE evento_id = ? ORDER BY created_at DESC')
    .all(eventoId);
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
};
