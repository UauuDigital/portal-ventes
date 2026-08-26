const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Stripe = require('stripe');

// controllers/stripeController.js necessita STRIPE_SECRET_KEY (stripeClient()
// la valida perquè no llanci fins que de veritat faci falta un client de
// Stripe — vegeu el comentari de stripeClient() al propi fitxer) i
// STRIPE_WEBHOOK_SECRET (per verificar la signatura). Cap de les dues és a
// .env.test (només hi ha DATABASE_URL/PGSSLMODE), així que es fixen aquí,
// mateix patró que SESSION_SECRET a sessionCookie.test.js o ADMIN_USER/
// ADMIN_PASS a authController.test.js. No calen valors reals: el webhook mai
// truca de veritat l'API de Stripe (només verifica la signatura HMAC en
// local amb stripe.webhooks.constructEvent), i la clau secreta només
// s'instancia (Stripe(''), no valida format) sense fer-hi cap crida.
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_per_a_proves';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy_per_a_proves';

const db = require('../config/db');
const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const { webhook } = require('../controllers/stripeController');

// Prefix distintiu perquè les dades de proves d'aquest fitxer siguin
// reconeixibles i no xoquin amb les d'altres fitxers de test corrent en
// paral·lel contra la mateixa BD física (db-test). Neteja pròpia a
// test.after: mai TRUNCATE global (vegeu capçalera de la tasca).
const PREFIX = '[TEST-WEBHOOK]';

const eventoIdsCreats = [];
const compraIdsCreats = [];

/** Crea un esdeveniment de prova mínim però vàlid i en registra l'id per netejar-lo després. */
async function crearEventoDeProva(overrides = {}) {
  const evento = await Evento.create({
    nombre: `${PREFIX} esdeveniment de proves`,
    fecha: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    precio: 1500,
    aforo_total: 50,
    fecha_limite_compra: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
  eventoIdsCreats.push(evento.id);
  return evento;
}

/** Crea una compra "pendiente" amb sessió de Stripe associada i en registra l'id per netejar-la després. */
async function crearCompraDeProva(eventoId, overrides = {}) {
  const compra = await Compra.create(
    {
      evento_id: eventoId,
      nombre_comprador: `${PREFIX} comprador de proves`,
      email: 'comprador-proves@example.com',
      telefono: null,
      cantidad: 1,
      importe_total: 1500,
      respuestas_campos: {},
      ...overrides,
    },
    { origen: 'client', usuari: 'comprador-proves@example.com' }
  );
  compraIdsCreats.push(compra.id);
  const sessionId = `cs_test_${PREFIX}_${crypto.randomBytes(8).toString('hex')}`;
  await Compra.setSessionId(compra.id, sessionId);
  return { ...compra, stripe_checkout_session_id: sessionId };
}

/** Construeix el payload JSON en brut i la capçalera stripe-signature vàlida per a un event. */
function construirEventSignat({ type, sessionId, secret = process.env.STRIPE_WEBHOOK_SECRET }) {
  const event = {
    id: `evt_test_${crypto.randomBytes(8).toString('hex')}`,
    object: 'event',
    type,
    data: { object: { id: sessionId, object: 'checkout.session' } },
  };
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}

/** req/res mínims que imiten el que Express passaria al handler (body en brut, com fa express.raw). */
function crearReq({ payload, signature }) {
  return {
    headers: signature === undefined ? {} : { 'stripe-signature': signature },
    body: payload,
    protocol: 'http',
    get: () => 'localhost:3000',
  };
}
function crearRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    send(text) {
      this.body = text;
      return this;
    },
  };
}

test.before(async () => {
  await db.aplicarSchema();
});

test.after(async () => {
  // Neteja només les files creades per aquest fitxer (mai un TRUNCATE
  // global: altres fitxers de test poden estar corrent en paral·lel contra
  // la mateixa BD db-test).
  if (compraIdsCreats.length) {
    await db.pool.query('DELETE FROM compras WHERE id = ANY($1::int[])', [compraIdsCreats]);
  }
  if (eventoIdsCreats.length) {
    await db.pool.query('DELETE FROM historial WHERE evento_id = ANY($1::int[])', [eventoIdsCreats]);
    await db.pool.query('DELETE FROM eventos WHERE id = ANY($1::int[])', [eventoIdsCreats]);
  }

  // Els asserts van dins del try perquè, si mai fallessin, el pool es tanqui
  // igualment al finally: en cas contrari un fallo de neteja deixaria el
  // procés de test penjat (pool obert) enlloc de reportar l'error i sortir,
  // afectant la resta de la suite compartida.
  try {
    const compresRestants = await db.pool.query('SELECT id FROM compras WHERE id = ANY($1::int[])', [compraIdsCreats]);
    const eventosRestants = await db.pool.query('SELECT id FROM eventos WHERE id = ANY($1::int[])', [eventoIdsCreats]);
    assert.equal(compresRestants.rows.length, 0, 'han quedat compres de proves sense netejar');
    assert.equal(eventosRestants.rows.length, 0, 'han quedat esdeveniments de proves sense netejar');
  } finally {
    await db.pool.end();
  }
});

test('checkout.session.completed vàlid marca la compra corresponent com a pagada', async () => {
  const evento = await crearEventoDeProva();
  const compra = await crearCompraDeProva(evento.id);

  const { payload, header } = construirEventSignat({
    type: 'checkout.session.completed',
    sessionId: compra.stripe_checkout_session_id,
  });

  const req = crearReq({ payload, signature: header });
  const res = crearRes();
  await webhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });

  const compraDesat = await Compra.getById(compra.id);
  assert.equal(compraDesat.estado_pago, 'pagado');
});

test('un redelivery del mateix checkout.session.completed no torna a marcar pagament ni a enviar un segon email', async (t) => {
  const evento = await crearEventoDeProva();
  const compra = await crearCompraDeProva(evento.id);

  const { payload, header } = construirEventSignat({
    type: 'checkout.session.completed',
    sessionId: compra.stripe_checkout_session_id,
  });

  // enviarEmailConfirmacio() ve destructurada a stripeController.js en
  // carregar-se el mòdul ("const { enviarEmailConfirmacio } =
  // require('../utils/mailer')"), així que per interceptar-la sense tocar
  // cap fitxer de producció cal mock.module() ABANS de tornar a requerir
  // stripeController.js (i esborrar-lo abans de la seva entrada de
  // require.cache, o el require tornaria la instància ja carregada dalt de
  // tot d'aquest fitxer, encara lligada al mailer real).
  const enviarEmailMock = t.mock.fn(async () => {});
  t.mock.module(require.resolve('../utils/mailer'), {
    exports: {
      enviarEmailConfirmacio: enviarEmailMock,
      enviarEmailPrueba: async () => {},
      VARIABLES_DISPONIBLES: [],
    },
  });

  const stripeControllerPath = require.resolve('../controllers/stripeController');
  delete require.cache[stripeControllerPath];
  const { webhook: webhookAmbMailerMockejat } = require('../controllers/stripeController');

  // Primera entrega: marca pagat i envia l'email (comprovat en aïllat al
  // test anterior; aquí ens interessa sobretot el recompte de crides).
  const req1 = crearReq({ payload, signature: header });
  const res1 = crearRes();
  await webhookAmbMailerMockejat(req1, res1);

  assert.equal(res1.statusCode, 200);
  assert.equal((await Compra.getById(compra.id)).estado_pago, 'pagado');
  assert.equal(enviarEmailMock.mock.calls.length, 1, 'hauria d\'haver enviat l\'email a la primera entrega');

  // Redelivery real de Stripe: MATEIX event (mateix payload/signatura), com
  // faria Stripe si no rep una resposta 2xx a temps o des d'un reenviament
  // manual del Dashboard.
  const req2 = crearReq({ payload, signature: header });
  const res2 = crearRes();
  await webhookAmbMailerMockejat(req2, res2);

  assert.equal(res2.statusCode, 200);
  assert.equal((await Compra.getById(compra.id)).estado_pago, 'pagado');
  assert.equal(
    enviarEmailMock.mock.calls.length,
    1,
    'el redelivery no hauria d\'haver disparat un segon email de confirmació'
  );

  // Neteja explícita del require.cache perquè la resta de tests d'aquest
  // fitxer (i el `webhook` capturat dalt de tot, que és una referència ja
  // vinculada i no es veu afectada per aquest canvi de cache) tornin a fer
  // servir el mòdul real si mai el requereixen de nou.
  delete require.cache[stripeControllerPath];
});

test('signatura de webhook absent o invàlida respon 400 i no toca la BD', async () => {
  const evento = await crearEventoDeProva();
  const compra = await crearCompraDeProva(evento.id);

  const { payload } = construirEventSignat({
    type: 'checkout.session.completed',
    sessionId: compra.stripe_checkout_session_id,
  });

  // Cas A: capçalera stripe-signature absent del tot.
  const reqSenseCapcalera = crearReq({ payload, signature: undefined });
  const resSenseCapcalera = crearRes();
  await webhook(reqSenseCapcalera, resSenseCapcalera);
  assert.equal(resSenseCapcalera.statusCode, 400);
  assert.match(String(resSenseCapcalera.body), /Webhook Error/);

  // Cas B: capçalera present però amb una signatura fabricada/incorrecta.
  const reqSignaturaInvalida = crearReq({ payload, signature: 't=1,v1=signatura-fabricada-incorrecta' });
  const resSignaturaInvalida = crearRes();
  await webhook(reqSignaturaInvalida, resSignaturaInvalida);
  assert.equal(resSignaturaInvalida.statusCode, 400);
  assert.match(String(resSignaturaInvalida.body), /Webhook Error/);

  // Cap dels dos intents ha de tocar la compra: segueix "pendiente" tal com era.
  const compraDesat = await Compra.getById(compra.id);
  assert.equal(compraDesat.estado_pago, 'pendiente');
});

test('checkout.session.completed per a un stripe_checkout_session_id inexistent respon 200 sense llançar', async () => {
  const sessionIdInexistent = `cs_test_${PREFIX}_inexistent_${crypto.randomBytes(8).toString('hex')}`;
  const compraPrevia = await Compra.findBySessionId(sessionIdInexistent);
  assert.equal(compraPrevia, undefined, 'precondició: aquest session_id no ha d\'existir a compras');

  const { payload, header } = construirEventSignat({
    type: 'checkout.session.completed',
    sessionId: sessionIdInexistent,
  });

  const req = crearReq({ payload, signature: header });
  const res = crearRes();

  await assert.doesNotReject(() => webhook(req, res));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
});
