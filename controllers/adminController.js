const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const Historial = require('../models/Historial');
const { toCsv } = require('../utils/csv');
const { traduirNomEsdeveniment, traduirATotsIdiomes } = require('../utils/traduccio');
const { validarDefinicionCampos } = require('../utils/camposFormulario');
const { validarInvitados } = require('../utils/validarInvitados');
const { enviarEmailPrueba } = require('../utils/mailer');

const IDIOMES_NOM = ['ca', 'es', 'en'];

/**
 * POST /api/admin/traduir-nom
 * Tradueix en temps real el "Nom" de l'esdeveniment mentre s'escriu al
 * formulari: es pot escriure en qualsevol dels 3 idiomes i es completen
 * sols els altres dos (que després es poden editar sense problema).
 */
async function traduirNom(req, res) {
  const text = String(req.body.nombre || '').trim();
  const idioma = String(req.body.idioma || '').toLowerCase();
  if (!text || !IDIOMES_NOM.includes(idioma)) {
    return res.status(400).json({ error: 'dades_invalides' });
  }
  const traduccions = await traduirATotsIdiomes(text, idioma);
  res.json(traduccions);
}

function validarEvento(body, { parcial } = {}) {
  const errors = [];
  const cal = (camp) => !parcial || body[camp] !== undefined;

  if (cal('nombre') && (!body.nombre || String(body.nombre).trim().length < 3)) {
    errors.push('nombre invàlid');
  }
  if (cal('fecha') && Number.isNaN(new Date(body.fecha).getTime())) {
    errors.push('fecha invàlida');
  }
  if (cal('precio')) {
    const precio = parseInt(body.precio, 10);
    if (!Number.isInteger(precio) || precio <= 0) errors.push('precio invàlid');
  }
  if (cal('aforo_total')) {
    const aforo = parseInt(body.aforo_total, 10);
    if (!Number.isInteger(aforo) || aforo <= 0) errors.push('aforo_total invàlid');
  }
  if (cal('fecha_limite_compra') && Number.isNaN(new Date(body.fecha_limite_compra).getTime())) {
    errors.push('fecha_limite_compra invàlida');
  }
  if (
    !parcial &&
    cal('fecha_limite_compra') &&
    !Number.isNaN(new Date(body.fecha_limite_compra).getTime()) &&
    new Date(body.fecha_limite_compra) < new Date()
  ) {
    errors.push('fecha_limite_compra no pot ser una data ja passada');
  }
  if (body.fecha && body.fecha_limite_compra) {
    if (new Date(body.fecha_limite_compra) > new Date(body.fecha)) {
      errors.push('fecha_limite_compra ha de ser anterior o igual a fecha');
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

/**
 * Xarxa de seguretat de traducció: el formulari ja tradueix en temps real
 * mentre s'escriu (vegeu traduirNom / configurarTraduccioNom al client),
 * així que això només actua si, per la raó que sigui, arriben buits (JS
 * desactivat, error de xarxa puntual...). Si el text original és buit
 * (p. ex. una descripció opcional no emplenada), no tradueix res.
 */
async function resoldreTraduccions(text, esBody, enBody) {
  let es = esBody;
  let en = enBody;
  if (text && (!es || !en)) {
    const traduit = await traduirNomEsdeveniment(text);
    if (!es) es = traduit.nombre_es;
    if (!en) en = traduit.nombre_en;
  }
  return { es, en };
}

async function crearEvento(req, res) {
  const errors = validarEvento(req.body);
  const camposFormulario = Array.isArray(req.body.campos_formulario) ? req.body.campos_formulario : [];
  errors.push(...validarDefinicionCampos(camposFormulario));
  const invitados = Array.isArray(req.body.invitados) ? req.body.invitados : [];
  errors.push(...validarInvitados(invitados));
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const nombre = String(req.body.nombre).trim();
  const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : '';

  const [nomTraduit, descTraduit] = await Promise.all([
    resoldreTraduccions(
      nombre,
      req.body.nombre_es ? String(req.body.nombre_es).trim() : '',
      req.body.nombre_en ? String(req.body.nombre_en).trim() : ''
    ),
    resoldreTraduccions(
      descripcion,
      req.body.descripcion_es ? String(req.body.descripcion_es).trim() : '',
      req.body.descripcion_en ? String(req.body.descripcion_en).trim() : ''
    ),
  ]);

  const evento = await Evento.create({
    nombre,
    nombre_es: nomTraduit.es,
    nombre_en: nomTraduit.en,
    fecha: new Date(req.body.fecha).toISOString(),
    descripcion: descripcion || null,
    descripcion_es: descTraduit.es || null,
    descripcion_en: descTraduit.en || null,
    precio: parseInt(req.body.precio, 10),
    aforo_total: parseInt(req.body.aforo_total, 10),
    fecha_limite_compra: new Date(req.body.fecha_limite_compra).toISOString(),
    estado: req.body.estado || 'abierto',
    invitados: invitados.map((inv) => ({
      nombre: String(inv.nombre).trim(),
      cargo: inv.cargo ? String(inv.cargo).trim() : null,
    })),
    campos_formulario: camposFormulario,
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
  if (req.body.campos_formulario !== undefined) {
    errors.push(...validarDefinicionCampos(req.body.campos_formulario));
  }
  if (req.body.invitados !== undefined) {
    errors.push(...validarInvitados(req.body.invitados));
  }
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const canvis = {};
  [
    'nombre', 'nombre_es', 'nombre_en', 'descripcion', 'descripcion_es', 'descripcion_en', 'estado',
    'email_asunto', 'email_html',
  ].forEach((camp) => {
    if (req.body[camp] !== undefined) canvis[camp] = String(req.body[camp]).trim();
  });
  // El formulari ja envia les 3 traduccions (fetes en temps real mentre
  // s'escrivia). Només retraduïm com a xarxa de seguretat si el text
  // (català) ha canviat però no ha arribat cap traducció amb la petició.
  if (canvis.nombre !== undefined && canvis.nombre !== actual.nombre && !canvis.nombre_es && !canvis.nombre_en) {
    const { nombre_es, nombre_en } = await traduirNomEsdeveniment(canvis.nombre);
    canvis.nombre_es = nombre_es;
    canvis.nombre_en = nombre_en;
  }
  if (
    canvis.descripcion !== undefined &&
    canvis.descripcion &&
    canvis.descripcion !== actual.descripcion &&
    !canvis.descripcion_es &&
    !canvis.descripcion_en
  ) {
    const { nombre_es, nombre_en } = await traduirNomEsdeveniment(canvis.descripcion);
    canvis.descripcion_es = nombre_es;
    canvis.descripcion_en = nombre_en;
  }
  if (req.body.precio !== undefined) canvis.precio = parseInt(req.body.precio, 10);
  if (req.body.aforo_total !== undefined) canvis.aforo_total = parseInt(req.body.aforo_total, 10);
  if (req.body.fecha !== undefined) canvis.fecha = new Date(req.body.fecha).toISOString();
  if (req.body.fecha_limite_compra !== undefined) {
    canvis.fecha_limite_compra = new Date(req.body.fecha_limite_compra).toISOString();
  }

  if (req.body.campos_formulario !== undefined) {
    canvis.campos_formulario = req.body.campos_formulario;
  }
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

async function llistarCompresEvento(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = await Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  const compras = await Compra.listByEvento(eventoId);
  res.json(compras.map(({ edit_token, ...resta }) => resta));
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

const COLUMNES_CSV = [
  { clau: 'nombre_comprador', capsalera: 'Nom' },
  { clau: 'email', capsalera: 'Email' },
  { clau: 'telefono', capsalera: 'Telèfon' },
  { clau: 'cantidad', capsalera: 'Quantitat' },
  { clau: 'importe_total_eur', capsalera: 'Import total (€)' },
  { clau: 'quiere_factura_text', capsalera: 'Factura' },
  { clau: 'nif', capsalera: 'NIF' },
  { clau: 'nombre_fiscal', capsalera: 'Nom fiscal' },
  { clau: 'direccion_fiscal', capsalera: 'Adreça fiscal' },
  { clau: 'estado_pago', capsalera: 'Estat pagament' },
  { clau: 'created_at', capsalera: 'Data compra' },
];

async function exportarComprasCsv(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = await Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const compres = await Compra.listByEvento(eventoId);
  const camposEvento = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];

  const columnesCampos = camposEvento.map((campo) => ({
    clau: `campo_${campo.id}`,
    capsalera: campo.etiqueta,
  }));

  const files = compres.map((c) => {
    const respuestas = c.respuestas_campos || {};
    const filaCampos = {};
    camposEvento.forEach((campo) => {
      const valor = respuestas[campo.id];
      filaCampos[`campo_${campo.id}`] = Array.isArray(valor) ? valor.join(', ') : (valor ?? '');
    });
    return {
      ...c,
      ...filaCampos,
      importe_total_eur: (c.importe_total / 100).toFixed(2),
      quiere_factura_text: c.quiere_factura ? 'Sí' : 'No',
    };
  });

  const csv = toCsv(files, [...COLUMNES_CSV, ...columnesCampos]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="compres-evento-${eventoId}.csv"`);
  res.send(csv);
}

module.exports = {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  eliminarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarComprasCsv,
  traduirNom,
  enviarEmailDePrueba,
  llistarHistorial,
};
