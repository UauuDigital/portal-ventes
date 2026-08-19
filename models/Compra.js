const crypto = require('crypto');
const db = require('../config/db');

// Estats que encara ocupen aforament: pagades + pendents que no han expirat
// (les pendents expirades es marquen 'cancelado' des del webhook checkout.session.expired)
const ESTATS_OCUPEN_AFORO = ['pendiente', 'pagado'];

// Temps que una reserva 'pendiente' compta com a ocupada encara que el
// webhook (o l'usuari tornant per cancel_url) no l'hagi marcada 'cancelado'.
// Independent del temps de vida real de la sessió de Stripe (EXPIRA_MINUTS a
// stripeController.js, que ha de ser >= 30 min per exigència de Stripe): quan
// l'usuari torna amb les fletxes del navegador (sense passar per cancel_url
// ni per cap redirecció), no hi ha manera de saber-ho al moment, així que
// aquest marge és el que decideix com de ràpid es torna a alliberar la plaça.
// Compensació acceptada: si algú triga més de MINUTS_RESERVA a completar el
// pagament mentre un altre compra la plaça "alliberada", hi ha risc de
// sobrevenda puntual (s'hauria de resoldre manualment si passa).
const MINUTS_RESERVA = parseInt(process.env.RESERVA_MINUTES || '15', 10);

async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO compras (
       evento_id, nombre_comprador, email, telefono, cantidad, importe_total,
       quiere_factura, nif, nombre_fiscal, direccion_fiscal, estado_pago,
       respuestas_campos, edit_token
     ) VALUES (
       @evento_id, @nombre_comprador, @email, @telefono, @cantidad, @importe_total,
       @quiere_factura, @nif, @nombre_fiscal, @direccion_fiscal, 'pendiente',
       @respuestas_campos, @edit_token
     ) RETURNING id`
  );
  const info = await stmt.run({
    nif: null,
    nombre_fiscal: null,
    direccion_fiscal: null,
    telefono: null,
    ...data,
    quiere_factura: !!data.quiere_factura,
    respuestas_campos: JSON.stringify(data.respuestas_campos || {}),
    edit_token: crypto.randomBytes(24).toString('hex'),
  });
  return getById(info.lastInsertRowid);
}

async function getById(id) {
  return db.prepare('SELECT * FROM compras WHERE id = ?').get(id);
}

async function findBySessionId(sessionId) {
  return db.prepare('SELECT * FROM compras WHERE stripe_checkout_session_id = ?').get(sessionId);
}

async function findByEditToken(token) {
  return db.prepare('SELECT * FROM compras WHERE edit_token = ?').get(token);
}

async function updateRespuestas(id, respuestas) {
  await db
    .prepare('UPDATE compras SET respuestas_campos = ? WHERE id = ?')
    .run(JSON.stringify(respuestas || {}), id);
  return getById(id);
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

/**
 * Places ja ocupades (pagades + pendents no expirades) per a un esdeveniment.
 *
 * Les reserves 'pendiente' només conten si són recents (< minutosExpiracion).
 * No podem confiar únicament en el webhook checkout.session.expired ni en la
 * crida des de cancel_url per alliberar-les: si l'usuari tanca la pestanya o
 * torna enrere amb el navegador en lloc de sortir des de Stripe, cap dels dos
 * es dispara i la reserva es quedaria ocupant plaça fins que algú la netegés.
 */
async function cantidadOcupada(eventoId) {
  const placeholders = ESTATS_OCUPEN_AFORO.map(() => '?').join(',');
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM compras
       WHERE evento_id = ? AND estado_pago IN (${placeholders})
         AND (estado_pago != 'pendiente' OR created_at > now() - (?::text || ' minutes')::interval)`
    )
    .get(eventoId, ...ESTATS_OCUPEN_AFORO, String(MINUTS_RESERVA));
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
  findByEditToken,
  updateRespuestas,
  setSessionId,
  marcarPagado,
  marcarCancelado,
  cantidadOcupada,
  listByEvento,
  eliminarPerEvento,
};
