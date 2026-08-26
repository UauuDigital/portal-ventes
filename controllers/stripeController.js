const Stripe = require('stripe');
const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const { enviarEmailConfirmacio } = require('../utils/mailer');
const { validarRespuestas } = require('../utils/camposFormulario');
const { EXPIRA_MINUTS } = require('../utils/checkoutConfig');

// Client de Stripe perezós: abans es creava a nivell de mòdul
// (Stripe(process.env.STRIPE_SECRET_KEY) just en fer require d'aquest
// fitxer), cosa que impedia fer require('../controllers/stripeController')
// en un test sense una clau vàlida, i que un desplegament sense
// STRIPE_SECRET_KEY arrenqués igualment sense cap error fins al primer
// intent real de cobrar (Stripe('') no llança res en aquesta versió de
// l'SDK). Ara el client només es crea — i la clau només es valida — la
// primera vegada que de veritat fa falta.
let stripe = null;
function stripeClient() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Falta STRIPE_SECRET_KEY a l\'entorn.');
    }
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Telèfon: accepta prefix internacional opcional, espais, guions i parèntesis,
// entre 9 i 15 dígits en total (suficient per a fixos/mòbils ES i estrangers).
const TELEFON_REGEX = /^\+?[\d\s().-]{9,20}$/;

function validarBody(body) {
  const errors = [];

  if (!body.nombre_comprador || String(body.nombre_comprador).trim().length < 2) {
    errors.push('nombre_comprador invàlid');
  }

  if (!EMAIL_REGEX.test(body.email || '')) {
    errors.push('email invàlid');
  }

  const telefono = String(body.telefono || '').trim();
  if (telefono && !TELEFON_REGEX.test(telefono)) {
    errors.push('telefono invàlid');
  }

  const cantidad = parseInt(body.cantidad, 10);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    errors.push('cantidad invàlida');
  }

  if (!body.accepta_condicions) {
    errors.push('cal acceptar les condicions de venda');
  }

  return errors;
}

/**
 * POST /api/checkout/crear
 * Valida disponibilitat (aforament + data límit), crea la Compra en estat
 * "pendiente" i obre una Checkout Session de Stripe. L'aforament NO es
 * descompta aquí: només es reserva "virtualment" fins que el webhook confirmi
 * el pagament o expiri la sessió.
 */
async function crearCheckoutSession(req, res) {
  try {
    const errors = validarBody(req.body);
    if (errors.length) {
      return res.status(400).json({ error: 'dades_invalides', detalls: errors });
    }

    // Si la landing mostra un selector (diversos esdeveniments actius alhora),
    // el formulari indica sobre quin es fa la compra; si no, s'agafa el més
    // urgent com sempre (comportament vàlid quan només n'hi ha un d'obert).
    const evento = req.body.evento_id
      ? await Evento.getById(parseInt(req.body.evento_id, 10))
      : await Evento.getActivo();
    if (!evento || evento.estado !== 'abierto') {
      return res.status(409).json({ error: 'no_hi_ha_event_actiu' });
    }

    if (new Date() > new Date(evento.fecha_limite_compra)) {
      return res.status(409).json({ error: 'data_limit_superada' });
    }

    const cantidad = parseInt(req.body.cantidad, 10);
    const ocupades = await Compra.cantidadOcupada(evento.id);
    const disponibles = evento.aforo_total - ocupades;
    if (cantidad > disponibles) {
      return res.status(409).json({ error: 'aforament_insuficient', disponibles });
    }

    const { errors: errorsCamps, respuestasNormalizadas } = validarRespuestas(
      evento.campos_formulario || [],
      req.body.respuestas_campos
    );
    if (errorsCamps.length) {
      return res.status(400).json({ error: 'dades_invalides', detalls: errorsCamps });
    }

    const importeTotal = cantidad * evento.precio; // cèntims

    const telefono = String(req.body.telefono || '').trim();

    const compra = await Compra.create({
      evento_id: evento.id,
      nombre_comprador: req.body.nombre_comprador.trim(),
      email: req.body.email.trim().toLowerCase(),
      telefono: telefono || null,
      cantidad,
      importe_total: importeTotal,
      respuestas_campos: respuestasNormalizadas,
    }, { origen: 'client', usuari: req.body.email.trim().toLowerCase() });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const expiresAt = Math.floor(Date.now() / 1000) + EXPIRA_MINUTS * 60;

    // La Compra ja s'ha creat en estat "pendiente" (ocupa aforament). Si la
    // trucada a Stripe falla a partir d'aquí, cal cancel·lar-la explícitament
    // perquè no quedi ocupant una plaça per sempre sense cap sessió de
    // pagament associada (mai arribaria cap webhook que la desbloqués).
    let session;
    try {
      session = await stripeClient().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: compra.email,
        expires_at: expiresAt,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: { name: `Entrada — ${evento.nombre}` },
              unit_amount: evento.precio,
            },
            quantity: cantidad,
          },
        ],
        metadata: { compra_id: String(compra.id), evento_id: String(evento.id) },
        success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cancel.html?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (errStripe) {
      await Compra.marcarCancelado(compra.id, {
        origen: 'automatic',
        usuari: 'sistema',
        descripcio: `Compra #${compra.id} cancel·lada automàticament (error creant la sessió de pagament)`,
      });
      throw errStripe;
    }

    await Compra.setSessionId(compra.id, session.id);

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Error creant Checkout Session:', err);
    return res.status(500).json({ error: 'error_intern' });
  }
}

/**
 * POST /api/checkout/cancelar
 * L'usuari ha arribat a la pantalla de cancel·lació de Stripe (ha sortit del
 * Checkout sense pagar). Allibera l'aforament reservat immediatament, en
 * lloc d'esperar que la sessió expiri (fins a EXPIRA_MINUTS).
 */
async function cancelarCheckoutSession(req, res) {
  const sessionId = req.body.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'dades_invalides' });
  }

  const compra = await Compra.findBySessionId(sessionId);
  if (compra && compra.estado_pago === 'pendiente') {
    await Compra.marcarCancelado(compra.id, { origen: 'client', usuari: compra.email });
    console.log(`Compra #${compra.id} cancel·lada per l'usuari des de cancel_url.`);
  }

  res.json({ ok: true });
}

/**
 * POST /webhook/stripe
 * Verifica la signatura i actualitza l'estat de la compra corresponent.
 * Requereix el body en brut (configurat a routes/webhookRoutes.js).
 */
async function webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeClient().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signatura de webhook invàlida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const compra = await Compra.findBySessionId(session.id);
      if (compra && compra.estado_pago !== 'pagado') {
        await Compra.marcarPagado(compra.id, { origen: 'automatic', usuari: 'sistema' });
        console.log(`Compra #${compra.id} marcada com a pagada.`);
        const evento = await Evento.getById(compra.evento_id);
        if (evento) {
          const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
          await enviarEmailConfirmacio({ compra: { ...compra, estado_pago: 'pagado' }, evento, baseUrl });
        }
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const compra = await Compra.findBySessionId(session.id);
      if (compra && compra.estado_pago === 'pendiente') {
        await Compra.marcarCancelado(compra.id, { origen: 'automatic', usuari: 'sistema' });
        console.log(`Compra #${compra.id} cancel·lada per expiració de sessió.`);
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}

/**
 * GET /api/checkout/confirmacion/:session_id
 * Dades per pintar la pàgina de confirmació (success.html) sense hardcodejar
 * res al frontend: la data/hora sempre es llegeix de l'esdeveniment, mai es
 * reescriu a mà a la pàgina de confirmació.
 */
async function obtenerConfirmacion(req, res) {
  const compra = await Compra.findBySessionId(req.params.session_id);
  if (!compra || compra.estado_pago !== 'pagado') {
    return res.status(404).json({ error: 'compra_no_trobada' });
  }
  const evento = await Evento.getById(compra.evento_id);
  if (!evento) return res.status(404).json({ error: 'compra_no_trobada' });

  res.json({
    evento: { nombre: evento.nombre, fecha: evento.fecha },
    compra: {
      nombre_comprador: compra.nombre_comprador,
      cantidad: compra.cantidad,
      importe_total: compra.importe_total,
    },
  });
}

module.exports = { crearCheckoutSession, cancelarCheckoutSession, webhook, obtenerConfirmacion };
