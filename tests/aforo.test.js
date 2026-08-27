const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../config/db');
const Evento = require('../models/Evento');
const Historial = require('../models/Historial');
// Referència "de sempre" al mòdul: capturada ABANS de qualsevol manipulació
// de require.cache que es faci més avall (test de MINUTS_RESERVA), perquè
// aquesta constant segueix vàlida encara que després es netegi la cache per
// tornar a carregar el mòdul amb un altre valor d'entorn.
const Compra = require('../models/Compra');
const { EXPIRA_MINUTS } = require('../utils/checkoutConfig');
const stripeController = require('../controllers/stripeController');

// Prefix distintiu perquè aquest fitxer pugui netejar només les seves pròpies
// files, encara que altres fitxers de test corrin en paral·lel contra la
// mateixa BD física (db-test) — vegeu regles d'aïllament de l'encàrrec.
const PREFIX = '[TEST-AFORO]';
const EVENTO_IDS_CREATS = [];

test.before(async () => {
  // Idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS): no fa
  // res si un altre fitxer de test ja l'ha aplicat abans.
  await db.aplicarSchema();
});

test.after(async () => {
  // Neteja només les files que ha creat AQUEST fitxer (pels evento_id que ha
  // anat apuntant), mai un TRUNCATE global que pogués afectar altres fitxers
  // de test corrent en paral·lel contra la mateixa BD.
  for (const id of EVENTO_IDS_CREATS) {
    await db.prepare('DELETE FROM compras WHERE evento_id = ?').run(id);
    await db.prepare('DELETE FROM historial WHERE evento_id = ?').run(id);
    await db.prepare('DELETE FROM eventos WHERE id = ?').run(id);
  }
  await db.pool.end();
});

/** Crea un esdeveniment de prova amb nom distintiu i el registra per netejar-lo després. */
async function crearEventoProva(overrides = {}) {
  const ara = Date.now();
  const sufix = `${ara}-${Math.random().toString(36).slice(2, 8)}`;
  const evento = await Evento.create({
    nombre: `${PREFIX} Esdeveniment ${sufix}`,
    fecha: new Date(ara + 7 * 24 * 3600 * 1000).toISOString(),
    precio: 1000,
    aforo_total: 3,
    fecha_limite_compra: new Date(ara + 6 * 24 * 3600 * 1000).toISOString(),
    invitados: [{ nombre: 'Convidat de prova' }],
    ...overrides,
  }, { origen: 'manual', usuari: 'test-aforo' });
  EVENTO_IDS_CREATS.push(evento.id);
  return evento;
}

/** Crea una compra 'pendiente' directament amb el model (camí real d'inserció). */
async function crearCompraProva(evento, overrides = {}) {
  return Compra.create({
    evento_id: evento.id,
    nombre_comprador: 'Comprador de prova',
    email: `comprador-${Math.random().toString(36).slice(2, 8)}@example.test`,
    telefono: null,
    cantidad: 1,
    importe_total: evento.precio,
    ...overrides,
  }, { origen: 'client', usuari: 'test-aforo' });
}

function fakeReq(body) {
  return {
    body,
    protocol: 'https',
    get: () => 'aforo-test.example',
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// ---------------------------------------------------------------------------
// Cas 1: rebuig d'aforament a crearCheckoutSession
// ---------------------------------------------------------------------------

test('un esdeveniment amb aforo_total=3 ple de compres pendents rebutja la 4a a crearCheckoutSession (controllers/stripeController.js)', async () => {
  const evento = await crearEventoProva({ aforo_total: 3 });

  // Omplim tot l'aforament amb compres 'pendiente' (el mateix camí que fa
  // servir el propi crearCheckoutSession per crear la reserva).
  for (let i = 0; i < 3; i++) {
    await crearCompraProva(evento);
  }

  assert.equal(await Compra.cantidadOcupada(evento.id), 3, 'les 3 compres pendents haurien d\'ocupar tot l\'aforament');

  const req = fakeReq({
    evento_id: evento.id,
    nombre_comprador: 'Comprador Extra',
    email: 'extra@example.test',
    telefono: '',
    cantidad: 1,
    accepta_condicions: true,
  });
  const res = fakeRes();

  await stripeController.crearCheckoutSession(req, res);

  // El rebuig ocorre a controllers/stripeController.js, dins crearCheckoutSession:
  //   const ocupades = await Compra.cantidadOcupada(evento.id);
  //   const disponibles = evento.aforo_total - ocupades;
  //   if (cantidad > disponibles) {
  //     return res.status(409).json({ error: 'aforament_insuficient', disponibles });
  //   }
  // (confirmat llegint el fitxer: bloc `evento.aforo_total - ocupades` seguit
  // del `if (cantidad > disponibles)`, ABANS de crear cap sessió de Stripe.)
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'aforament_insuficient', disponibles: 0 });

  // No s'ha inserit cap compra nova arran de l'intent rebutjat.
  assert.equal(await Compra.cantidadOcupada(evento.id), 3);
});

test('la validació d\'aforament NO és al model: Compra.create() insereix igualment encara que superi l\'aforo_total', async () => {
  // Confirma "el punt exacte" de la comprovació: no és a Compra.create (el
  // model no sap res d'aforo_total), és exclusivament a stripeController.
  const evento = await crearEventoProva({ aforo_total: 1 });

  await crearCompraProva(evento); // omple l'única plaça
  assert.equal(await Compra.cantidadOcupada(evento.id), 1);

  // Compra.create no valida res d'aforament: la 2a compra pendent per a un
  // esdeveniment amb aforo_total=1 s'insereix sense queixar-se.
  const extra = await crearCompraProva(evento);
  assert.ok(extra && extra.id, 'Compra.create ha d\'inserir igualment (no valida aforament pel seu compte)');
  assert.equal(await Compra.cantidadOcupada(evento.id), 2, 'ara hi ha 2 compres pendents ocupant 1 sola plaça (sobrevenda potencial)');
});

// ---------------------------------------------------------------------------
// Cas 2: MINUTS_RESERVA >= EXPIRA_MINUTS (protecció amb Math.max)
// ---------------------------------------------------------------------------

/**
 * Torna a requerir utils/checkoutConfig.js i models/Compra.js amb un altre
 * valor de RESERVA_MINUTES/CHECKOUT_EXPIRES_MINUTES a l'entorn. Cal fixar
 * process.env ABANS de requerir (MINUTS_RESERVA es calcula una sola vegada en
 * carregar el mòdul) i esborrar require.cache perquè Node no torni la còpia
 * ja carregada. L'entorn es restaura immediatament després del require perquè
 * no s'escapi cap a altres tests d'aquest mateix fitxer (que fan servir la
 * referència `Compra` capturada dalt de tot, no aquesta còpia "fresca").
 */
function requerirCompraAmbEntorn({ reservaMinutes, expiraMinutes } = {}) {
  const abansReserva = process.env.RESERVA_MINUTES;
  const abansExpira = process.env.CHECKOUT_EXPIRES_MINUTES;

  if (reservaMinutes === undefined) delete process.env.RESERVA_MINUTES;
  else process.env.RESERVA_MINUTES = String(reservaMinutes);
  if (expiraMinutes === undefined) delete process.env.CHECKOUT_EXPIRES_MINUTES;
  else process.env.CHECKOUT_EXPIRES_MINUTES = String(expiraMinutes);

  delete require.cache[require.resolve('../utils/checkoutConfig')];
  delete require.cache[require.resolve('../models/Compra')];
  const CompraFresc = require('../models/Compra');
  const { EXPIRA_MINUTS: expiraFresc } = require('../utils/checkoutConfig');

  if (abansReserva === undefined) delete process.env.RESERVA_MINUTES;
  else process.env.RESERVA_MINUTES = abansReserva;
  if (abansExpira === undefined) delete process.env.CHECKOUT_EXPIRES_MINUTES;
  else process.env.CHECKOUT_EXPIRES_MINUTES = abansExpira;

  return { CompraFresc, expiraFresc };
}

/** Recula el created_at d'una compra `minuts` enrere (SQL real, no un mock de Date). */
async function envellirCompra(compraId, minuts) {
  await db
    .prepare(`UPDATE compras SET created_at = now() - (? || ' minutes')::interval WHERE id = ?`)
    .run(String(minuts), compraId);
}

test('amb els valors reals de .env.test, MINUTS_RESERVA es resol >= EXPIRA_MINUTS', async () => {
  // Valors reals de l'entorn actual (sense forçar res): confirma per escrit
  // el que ja es va verificar manualment (FIX3 de la tanda 1).
  assert.equal(EXPIRA_MINUTS, 30, 'EXPIRA_MINUTS amb els valors per defecte hauria de ser 30');

  const evento = await crearEventoProva({ aforo_total: 10 });
  const compra = await crearCompraProva(evento);

  // Una reserva pendent de fa 20 minuts (entre RESERVA_MINUTES=15 per
  // defecte i EXPIRA_MINUTS=30) encara compta com a ocupada: si el sistema
  // llegís només RESERVA_MINUTES (15) enlloc del Math.max, ja hauria deixat
  // de comptar-la en aquest punt.
  await envellirCompra(compra.id, 20);
  assert.equal(await Compra.cantidadOcupada(evento.id), 1, 'als 20 minuts encara hauria d\'ocupar plaça (per sobre de RESERVA_MINUTES=15 solt)');

  // Passats els EXPIRA_MINUTS (30) sí que deixa de comptar.
  await envellirCompra(compra.id, 35);
  assert.equal(await Compra.cantidadOcupada(evento.id), 0, 'passats els 30 minuts ja no hauria d\'ocupar plaça');
});

test('Math.max protegeix encara que RESERVA_MINUTES es configuri per sota de CHECKOUT_EXPIRES_MINUTES', async () => {
  // Sense el Math.max de models/Compra.js, RESERVA_MINUTES=5 faria que
  // MINUTS_RESERVA valgués 5: una reserva de fa 10 minuts ja hauria deixat
  // de comptar. Amb el Math.max(EXPIRA_MINUTS, RESERVA_MINUTES) real del
  // codi, ha de seguir comptant perquè EXPIRA_MINUTS (>=30, exigència de
  // Stripe) mana per sobre.
  const { CompraFresc, expiraFresc } = requerirCompraAmbEntorn({ reservaMinutes: 5, expiraMinutes: 30 });
  assert.equal(expiraFresc, 30);

  const evento = await crearEventoProva({ aforo_total: 10 });
  const compra = await crearCompraProva(evento);

  await envellirCompra(compra.id, 10);
  const ocupades = await CompraFresc.cantidadOcupada(evento.id);
  assert.equal(
    ocupades, 1,
    'amb RESERVA_MINUTES=5 forçat, si no fos pel Math.max una reserva de fa 10 minuts ja hauria deixat de comptar (bug de sobrevenda)'
  );
});

// ---------------------------------------------------------------------------
// Cas 3: sobrevenda detectada per marcarPagado()/comprovarSobrevenda(), sense bloquejar el pagament
// ---------------------------------------------------------------------------

test('marcarPagado() detecta sobrevenda i escriu historial amb accio="sobrevenda", sense bloquejar cap dels dos pagaments', async () => {
  const evento = await crearEventoProva({ aforo_total: 1 });

  // Forcem l'estat de sobrevenda saltant-nos deliberadament la validació
  // d'alt nivell (cas 1): dues compres 'pendiente' pel mateix seient, tal com
  // podria passar amb dues peticions concurrents que passen totes dues la
  // comprovació d'aforament abans que cap hagi inserit la seva compra.
  const compraA = await crearCompraProva(evento);
  const compraB = await crearCompraProva(evento);

  const historialAbans = await Historial.llistar({ eventoId: evento.id, limit: 100 });
  const sobrevendesAbans = historialAbans.filter((h) => h.accio === 'sobrevenda').length;

  await Compra.marcarPagado(compraA.id, { origen: 'test', usuari: 'test-aforo' });
  await Compra.marcarPagado(compraB.id, { origen: 'test', usuari: 'test-aforo' });

  const compraAPagada = await Compra.getById(compraA.id);
  const compraBPagada = await Compra.getById(compraB.id);

  // El pagament NO es bloqueja malgrat la sobrevenda detectada (comportament
  // intencionat: comentari de comprovarSobrevenda a models/Compra.js diu que
  // "MAI bloqueja" perquè Stripe ja ha cobrat el comprador en aquest punt).
  assert.equal(compraAPagada.estado_pago, 'pagado', 'la compra A ha de quedar pagada igualment');
  assert.equal(compraBPagada.estado_pago, 'pagado', 'la compra B ha de quedar pagada igualment (no es bloqueja pel fet de superar l\'aforo)');

  const historialDespres = await Historial.llistar({ eventoId: evento.id, limit: 100 });
  const entradesSobrevenda = historialDespres.filter((h) => h.accio === 'sobrevenda');

  assert.ok(
    entradesSobrevenda.length > sobrevendesAbans,
    'marcarPagado ha d\'escriure almenys una entrada nova a historial amb accio="sobrevenda"'
  );
  const entrada = entradesSobrevenda[0];
  assert.equal(entrada.evento_id, evento.id);
  assert.equal(entrada.origen, 'automatic');
  assert.equal(entrada.usuari, 'sistema');
  assert.ok(entrada.descripcio.includes('Sobrevenda detectada'));
  assert.deepEqual(entrada.dades_despres, { ocupades: 2, aforo_total: 1 });
});
