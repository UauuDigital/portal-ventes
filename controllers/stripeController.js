const Stripe = require('stripe');
const Evento = require('../models/Evento');
const Compra = require('../models/Compra');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
// Stripe exigeix que expires_at sigui com a mínim 30 minuts després de crear
// la sessió de Checkout.
const EXPIRA_MINUTS = Math.max(30, parseInt(process.env.CHECKOUT_EXPIRES_MINUTES || '30', 10));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Telèfon: accepta prefix internacional opcional, espais, guions i parèntesis,
// entre 9 i 15 dígits en total (suficient per a fixos/mòbils ES i estrangers).
const TELEFON_REGEX = /^\+?[\d\s().-]{9,20}$/;
// NIF (DNI + lletra), NIE (X/Y/Z + 7 dígits + lletra) i CIF (lletra + 7 dígits + lletra/dígit).
// Valida format, no el dígit de control — suficient per detectar errors de picada
// sense necessitat d'una llibreria externa.
const NIF_REGEX = /^[0-9]{8}[A-Za-z]$/;
const NIE_REGEX = /^[XYZxyz][0-9]{7}[A-Za-z]$/;
const CIF_REGEX = /^[A-Za-z][0-9]{7}[A-Za-z0-9]$/;

function nifValid(value) {
  const v = String(value || '').trim().toUpperCase();
  return NIF_REGEX.test(v) || NIE_REGEX.test(v) || CIF_REGEX.test(v);
}

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

  if (body.quiere_factura) {
    if (!body.nif || !body.nombre_fiscal || !body.direccion_fiscal) {
      errors.push('dades fiscals incompletes');
    } else if (!nifValid(body.nif)) {
      errors.push('nif invàlid');
    }
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

    const importeTotal = cantidad * evento.precio; // cèntims

    const telefono = String(req.body.telefono || '').trim();

    const compra = await Compra.create({
      evento_id: evento.id,
      nombre_comprador: req.body.nombre_comprador.trim(),
      email: req.body.email.trim().toLowerCase(),
      telefono: telefono || null,
      cantidad,
      importe_total: importeTotal,
      quiere_factura: !!req.body.quiere_factura,
      nif: req.body.quiere_factura ? String(req.body.nif).trim().toUpperCase() : null,
      nombre_fiscal: req.body.quiere_factura ? String(req.body.nombre_fiscal).trim() : null,
      direccion_fiscal: req.body.quiere_factura ? String(req.body.direccion_fiscal).trim() : null,
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const expiresAt = Math.floor(Date.now() / 1000) + EXPIRA_MINUTS * 60;

    const session = await stripe.checkout.sessions.create({
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
      cancel_url: `${baseUrl}/cancel.html`,
    });

    await Compra.setSessionId(compra.id, session.id);

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Error creant Checkout Session:', err);
    return res.status(500).json({ error: 'error_intern' });
  }
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
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signatura de webhook invàlida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const compra = await Compra.findBySessionId(session.id);
      if (compra && compra.estado_pago !== 'pagado') {
        await Compra.marcarPagado(compra.id);
        console.log(`Compra #${compra.id} marcada com a pagada.`);
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const compra = await Compra.findBySessionId(session.id);
      if (compra && compra.estado_pago === 'pendiente') {
        await Compra.marcarCancelado(compra.id);
        console.log(`Compra #${compra.id} cancel·lada per expiració de sessió.`);
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}

module.exports = { crearCheckoutSession, webhook };
