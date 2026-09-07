const PDFDocument = require('pdfkit');
const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const Historial = require('../models/Historial');
const { validarInvitados } = require('../utils/validarInvitados');
const { enviarEmailPrueba } = require('../utils/mailer');
const { escriureAsistentsPdf } = require('../utils/pdfAsistentes');
const { AFORAMENT_FIX, PREU_FIX_CENTIMS, calcularFechaLimiteCompra } = require('../utils/eventoConfig');

function validarEvento(body, { parcial } = {}) {
  const errors = [];
  const cal = (camp) => !parcial || body[camp] !== undefined;

  if (cal('nombre') && (!body.nombre || String(body.nombre).trim().length < 3)) {
    errors.push('nombre invàlid');
  }
  if (cal('fecha') && Number.isNaN(new Date(body.fecha).getTime())) {
    errors.push('fecha invàlida');
  }
  // fecha_limite_compra ja no ve del body (es calcula sempre a partir de
  // fecha, vegeu calcularFechaLimiteCompra): l'única validació que en
  // queda és que la pròpia fecha no sigui tan propera que el límit
  // calculat (48h abans) ja hagi passat. Només es comprova quan fecha
  // s'està fixant en aquesta petició (creació, o edició que la canvia).
  if (cal('fecha') && !Number.isNaN(new Date(body.fecha).getTime())) {
    if (new Date(calcularFechaLimiteCompra(body.fecha)) < new Date()) {
      errors.push("la data de l'esdeveniment és massa propera: la data límit de compra (48h abans) ja hauria passat");
    }
  }
  if (body.estado !== undefined && !['abierto', 'cerrado'].includes(body.estado)) {
    errors.push('estado invàlid');
  }

  return errors;
}

async function llistarEventos(req, res) {
  const eventos = await Evento.listAll();
  const ambOcupacio = await Promise.all(
    eventos.map(async (ev) => ({ ...ev, ocupadas: await Compra.cantidadOcupada(ev.id) }))
  );
  res.json(ambOcupacio);
}

async function obtenirEvento(req, res) {
  const evento = await Evento.getById(parseInt(req.params.id, 10));
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  res.json(evento);
}

async function crearEvento(req, res) {
  const errors = validarEvento(req.body);
  const invitados = Array.isArray(req.body.invitados) ? req.body.invitados : [];
  errors.push(...validarInvitados(invitados));
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const nombre = String(req.body.nombre).trim();
  const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : '';

  const evento = await Evento.create({
    nombre,
    fecha: new Date(req.body.fecha).toISOString(),
    descripcion: descripcion || null,
    // Aforament i preu ja no venen del body: són fixos per a tots els
    // esdeveniments (vegeu utils/eventoConfig.js). Es descarta qualsevol
    // valor que arribi aquí encara que sigui vàlid.
    precio: PREU_FIX_CENTIMS,
    aforo_total: AFORAMENT_FIX,
    // Igual que precio/aforo_total: mai ve del body, es calcula sempre a
    // partir de la data de l'esdeveniment (vegeu utils/eventoConfig.js).
    fecha_limite_compra: calcularFechaLimiteCompra(req.body.fecha),
    estado: req.body.estado || 'abierto',
    invitados: invitados.map((inv) => ({
      nombre: String(inv.nombre).trim(),
      cargo: inv.cargo ? String(inv.cargo).trim() : null,
    })),
    email_asunto: req.body.email_asunto ? String(req.body.email_asunto).trim() : null,
    email_html: req.body.email_html ? String(req.body.email_html).trim() : null,
  }, { origen: 'manual', usuari: req.adminUser });
  res.status(201).json(evento);
}

async function actualitzarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const actual = await Evento.getById(id);
  if (!actual) return res.status(404).json({ error: 'no_trobat' });

  const errors = validarEvento(req.body, { parcial: true });
  if (req.body.invitados !== undefined) {
    errors.push(...validarInvitados(req.body.invitados));
  }
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const canvis = {};
  ['nombre', 'descripcion', 'estado', 'email_asunto', 'email_html'].forEach((camp) => {
    if (req.body[camp] !== undefined) canvis[camp] = String(req.body[camp]).trim();
  });
  // Igual que a crearEvento: fixos sempre, sense importar què arribi al
  // body (vegeu utils/eventoConfig.js).
  canvis.precio = PREU_FIX_CENTIMS;
  canvis.aforo_total = AFORAMENT_FIX;
  if (req.body.fecha !== undefined) canvis.fecha = new Date(req.body.fecha).toISOString();
  // Sempre recalculada a partir de la fecha resultant (la nova si canvia
  // en aquesta edició, l'actual si no) — mai acceptada del body.
  canvis.fecha_limite_compra = calcularFechaLimiteCompra(canvis.fecha || actual.fecha);

  if (req.body.invitados !== undefined) {
    canvis.invitados = req.body.invitados.map((inv) => ({
      nombre: String(inv.nombre).trim(),
      cargo: inv.cargo ? String(inv.cargo).trim() : null,
    }));
  }

  const evento = await Evento.update(id, canvis, { origen: 'manual', usuari: req.adminUser });
  res.json(evento);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/eventos/:id/email-prova
 * Envia l'email de confirmació amb dades d'exemple a l'adreça indicada,
 * fent servir l'assumpte/HTML que arriben al body (encara no desats),
 * perquè l'admin pugui iterar abans de guardar els canvis.
 */
async function enviarEmailDePrueba(req, res) {
  const id = parseInt(req.params.id, 10);
  const evento = await Evento.getById(id);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const destinatario = String(req.body.destinatario || '').trim();
  if (!EMAIL_REGEX.test(destinatario)) {
    return res.status(400).json({ error: 'dades_invalides', detalls: ['email de destinatari invàlid'] });
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  try {
    await enviarEmailPrueba({
      destinatario,
      asunto: req.body.email_asunto ? String(req.body.email_asunto) : '',
      html: req.body.email_html ? String(req.body.email_html) : '',
      evento,
      baseUrl,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error enviant l\'email de prova:', err);
    res.status(502).json({ error: 'error_enviament_email' });
  }
}

async function eliminarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const evento = await Evento.getById(id);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const compresEvento = await Compra.listByEvento(id);
  const teCompres = compresEvento.length > 0;
  const forcar = req.query.forzar === '1';

  if (teCompres && !forcar) {
    return res.status(409).json({ error: 'te_compres_associades' });
  }

  if (teCompres) {
    await Compra.eliminarPerEvento(id, { origen: 'manual', usuari: req.adminUser });
  }

  await Evento.remove(id, { origen: 'manual', usuari: req.adminUser });
  res.status(204).send();
}

// Filtre per estat de pagament, compartit entre la taula de l'admin i
// l'exportació a PDF perquè sempre coincideixin: per defecte només
// compres 'pagado' (l'informe d'auditoria inicial assenyalava que la
// taula no distingia pagades de pendents/cancel·lades — es soluciona
// amagant per defecte les que no interessen, amb un toggle exprés al
// frontend per veure-les totes). `?estado=todas` treu el filtre.
function resoldreFiltreEstat(req) {
  return req.query.estado === 'todas' ? undefined : 'pagado';
}

async function llistarCompresEvento(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = await Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  const compras = await Compra.listByEvento(eventoId, { estado: resoldreFiltreEstat(req) });
  const ambAcompanyants = await Promise.all(
    compras.map(async (compra) => ({
      ...compra,
      acompanyants: await Compra.getAcompanyants(compra.id),
    }))
  );
  res.json(ambAcompanyants);
}

async function cancelarCompra(req, res) {
  const id = parseInt(req.params.id, 10);
  const compra = await Compra.getById(id);
  if (!compra) return res.status(404).json({ error: 'no_trobat' });
  if (['cancelado', 'reembolsado'].includes(compra.estado_pago)) {
    return res.status(409).json({ error: 'operacio_no_aplicable' });
  }
  await Compra.marcarCancelado(id, { origen: 'manual', usuari: req.adminUser });
  res.json(await Compra.getById(id));
}

/**
 * GET /api/admin/historial
 * Registre de moviments (creacions, modificacions manuals i automàtiques,
 * compres, pagaments i cancel·lacions), amb paginació i filtre opcional
 * per esdeveniment. Accessible en lectura per admin i viewer.
 */
async function llistarHistorial(req, res) {
  const eventoId = req.query.eventoId ? parseInt(req.query.eventoId, 10) : undefined;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  const entrades = await Historial.llistar({ eventoId, limit, offset });
  res.json(entrades);
}

/**
 * GET /api/admin/eventos/:id/compras/export.pdf
 * Substitueix l'antiga exportació a CSV de compres per un llistat
 * d'ASSISTENTS (no de compres): comprador + cada acompanyant de cada
 * compra, un per fila, sense distingir-los visualment entre ells. Respecta
 * el mateix filtre d'estat de pagament que la taula (?estado=todas per
 * incloure-les totes; per defecte, només pagades).
 */
async function exportarAsistentesPdf(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = await Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const filtreEstat = resoldreFiltreEstat(req);
  const compres = await Compra.listByEvento(eventoId, { estado: filtreEstat });
  const compresAmbAcompanyants = await Promise.all(
    compres.map(async (c) => ({ ...c, acompanyants: await Compra.getAcompanyants(c.id) }))
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="assistents-evento-${eventoId}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);
  escriureAsistentsPdf(doc, {
    evento,
    compres: compresAmbAcompanyants,
    // Amb el filtre per defecte totes les files dirien "Pagat" — la
    // columna només aporta informació quan el llistat pot incloure
    // compres en altres estats (toggle "totes").
    incloureEstat: filtreEstat === undefined,
  });
  doc.end();
}

module.exports = {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  eliminarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarAsistentesPdf,
  enviarEmailDePrueba,
  llistarHistorial,
};
