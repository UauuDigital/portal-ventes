const crypto = require('crypto');
const db = require('../config/db');
const Historial = require('./Historial');
const Evento = require('./Evento');
const { EXPIRA_MINUTS } = require('../utils/checkoutConfig');

// Estats que encara ocupen aforament: pagades + pendents que no han expirat
// (les pendents expirades es marquen 'cancelado' des del webhook checkout.session.expired)
const ESTATS_OCUPEN_AFORO = ['pendiente', 'pagado'];

// Temps que una reserva 'pendiente' compta com a ocupada encara que el
// webhook (o l'usuari tornant per cancel_url) no l'hagi marcada 'cancelado'.
// Quan l'usuari torna amb les fletxes del navegador (sense passar per
// cancel_url ni per cap redirecció), no hi ha manera de saber-ho al moment,
// així que aquest marge és el que decideix com de ràpid es torna a alliberar
// la plaça.
//
// Ha de ser sempre >= EXPIRA_MINUTS (el temps que la sessió de Stripe segueix
// viva i pagable, utils/checkoutConfig.js): si RESERVA_MINUTES fos més curt,
// la reserva deixaria de comptar com a ocupada abans que la sessió de Stripe
// hagués pogut expirar, i algú altre podria comprar la plaça "alliberada"
// mentre el primer comprador encara la pot pagar — sobrevenda determinista,
// no una condició de carrera rara. Per això es deriva amb Math.max enlloc de
// llegir-se com un valor solt que es pogués desincronitzar.
const MINUTS_RESERVA = Math.max(EXPIRA_MINUTS, parseInt(process.env.RESERVA_MINUTES || '15', 10));

async function create(data, meta = {}) {
  const stmt = db.prepare(
    `INSERT INTO compras (
       evento_id, nombre_comprador, email, telefono, cantidad, importe_total,
       estado_pago, respuestas_campos, edit_token
     ) VALUES (
       @evento_id, @nombre_comprador, @email, @telefono, @cantidad, @importe_total,
       'pendiente', @respuestas_campos, @edit_token
     ) RETURNING id`
  );
  const info = await stmt.run({
    telefono: null,
    ...data,
    respuestas_campos: JSON.stringify(data.respuestas_campos || {}),
    edit_token: crypto.randomBytes(24).toString('hex'),
  });
  const compra = await getById(info.lastInsertRowid);
  // edit_token dona accés directe (sense login) a editar les dades del
  // comprador: no es desa a l'historial perquè el rol viewer hi té accés de
  // només lectura i no ha de poder veure ni reutilitzar aquest token.
  const { edit_token: _editToken, ...compraPerHistorial } = compra;
  await Historial.registrar({
    tipus_entitat: 'compra',
    entitat_id: compra.id,
    evento_id: compra.evento_id,
    accio: 'compra',
    origen: meta.origen || 'client',
    usuari: meta.usuari || compra.email,
    descripcio: `Compra #${compra.id} creada per ${compra.nombre_comprador} (${compra.cantidad} entrades)`,
    dades_despres: compraPerHistorial,
  });
  return compra;
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

/**
 * Comprovació de sobrevenda posterior al pagament: només detecta i deixa
 * rastre, MAI bloqueja. Quan es crida, Stripe ja ha cobrat el comprador —
 * rebutjar o desfer el pagament aquí no és una opció, l'única resposta és
 * alertar l'equip perquè ho resolgui manualment (contactar el comprador,
 * ampliar l'aforament, etc.). El risc real que això detecta és la
 * comprovació d'aforament sense transacció a crearCheckoutSession
 * (stripeController.js): dues peticions concurrents pel darrer seient poden
 * passar totes dues la comprovació abans que cap hagi inserit la compra.
 */
async function comprovarSobrevenda(eventoId) {
  const evento = await Evento.getById(eventoId);
  if (!evento) return;
  const ocupades = await cantidadOcupada(eventoId);
  if (ocupades <= evento.aforo_total) return;

  const descripcio = `Sobrevenda detectada a "${evento.nombre}": ${ocupades}/${evento.aforo_total} places ocupades`;
  console.error(descripcio);
  await Historial.registrar({
    tipus_entitat: 'evento',
    entitat_id: eventoId,
    evento_id: eventoId,
    accio: 'sobrevenda',
    origen: 'automatic',
    usuari: 'sistema',
    descripcio,
    dades_despres: { ocupades, aforo_total: evento.aforo_total },
  });
}

async function marcarPagado(id, meta = {}) {
  const abans = await getById(id);
  if (!abans || abans.estado_pago === 'pagado') return;
  await db.prepare("UPDATE compras SET estado_pago = 'pagado' WHERE id = ?").run(id);
  await Historial.registrar({
    tipus_entitat: 'compra',
    entitat_id: id,
    evento_id: abans.evento_id,
    accio: 'pagament',
    origen: meta.origen || 'automatic',
    usuari: meta.usuari || 'sistema',
    descripcio: meta.descripcio || `Compra #${id} marcada com a pagada`,
    dades_abans: { estado_pago: abans.estado_pago },
    dades_despres: { estado_pago: 'pagado' },
  });
  await comprovarSobrevenda(abans.evento_id);
}

const DESCRIPCIONS_CANCELACIO = {
  manual: (id) => `Compra #${id} cancel·lada per l'admin`,
  automatic: (id) => `Compra #${id} cancel·lada automàticament (sessió de pagament expirada)`,
  client: (id) => `Compra #${id} cancel·lada per l'usuari`,
};

async function marcarCancelado(id, meta = {}) {
  const abans = await getById(id);
  if (!abans || abans.estado_pago === 'cancelado') return;
  await db.prepare("UPDATE compras SET estado_pago = 'cancelado' WHERE id = ?").run(id);
  const origen = meta.origen || 'automatic';
  await Historial.registrar({
    tipus_entitat: 'compra',
    entitat_id: id,
    evento_id: abans.evento_id,
    accio: 'cancelacio',
    origen,
    usuari: meta.usuari || (origen === 'automatic' ? 'sistema' : null),
    descripcio: meta.descripcio || (DESCRIPCIONS_CANCELACIO[origen] || DESCRIPCIONS_CANCELACIO.automatic)(id),
    dades_abans: { estado_pago: abans.estado_pago },
    dades_despres: { estado_pago: 'cancelado' },
  });
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

async function eliminarPerEvento(eventoId, meta = {}) {
  const compres = await listByEvento(eventoId);
  await db.prepare('DELETE FROM compras WHERE evento_id = ?').run(eventoId);
  if (compres.length > 0) {
    await Historial.registrar({
      tipus_entitat: 'compra',
      entitat_id: null,
      evento_id: eventoId,
      accio: 'eliminacio',
      origen: meta.origen || 'manual',
      usuari: meta.usuari || null,
      descripcio: `${compres.length} compra${compres.length === 1 ? '' : 's'} eliminada${compres.length === 1 ? '' : 's'} en eliminar l'esdeveniment`,
      dades_abans: { total: compres.length },
    });
  }
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
