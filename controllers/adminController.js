const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const { toCsv } = require('../utils/csv');

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

function llistarEventos(req, res) {
  res.json(Evento.listAll());
}

function obtenirEvento(req, res) {
  const evento = Evento.getById(parseInt(req.params.id, 10));
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  res.json(evento);
}

function crearEvento(req, res) {
  const errors = validarEvento(req.body);
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const evento = Evento.create({
    nombre: String(req.body.nombre).trim(),
    fecha: new Date(req.body.fecha).toISOString(),
    descripcion: req.body.descripcion ? String(req.body.descripcion).trim() : null,
    precio: parseInt(req.body.precio, 10),
    aforo_total: parseInt(req.body.aforo_total, 10),
    fecha_limite_compra: new Date(req.body.fecha_limite_compra).toISOString(),
    estado: req.body.estado || 'abierto',
  });
  res.status(201).json(evento);
}

function actualitzarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const actual = Evento.getById(id);
  if (!actual) return res.status(404).json({ error: 'no_trobat' });

  const errors = validarEvento(req.body, { parcial: true });
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const canvis = {};
  ['nombre', 'descripcion', 'estado'].forEach((camp) => {
    if (req.body[camp] !== undefined) canvis[camp] = req.body[camp];
  });
  if (req.body.precio !== undefined) canvis.precio = parseInt(req.body.precio, 10);
  if (req.body.aforo_total !== undefined) canvis.aforo_total = parseInt(req.body.aforo_total, 10);
  if (req.body.fecha !== undefined) canvis.fecha = new Date(req.body.fecha).toISOString();
  if (req.body.fecha_limite_compra !== undefined) {
    canvis.fecha_limite_compra = new Date(req.body.fecha_limite_compra).toISOString();
  }

  const evento = Evento.update(id, canvis);
  res.json(evento);
}

function eliminarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const evento = Evento.getById(id);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const teCompres = Compra.listByEvento(id).length > 0;
  const forcar = req.query.forzar === '1';

  if (teCompres && !forcar) {
    return res.status(409).json({ error: 'te_compres_associades' });
  }

  if (teCompres) {
    Compra.eliminarPerEvento(id);
  }

  Evento.remove(id);
  res.status(204).send();
}

function llistarCompresEvento(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  res.json(Compra.listByEvento(eventoId));
}

function cancelarCompra(req, res) {
  const id = parseInt(req.params.id, 10);
  const compra = Compra.getById(id);
  if (!compra) return res.status(404).json({ error: 'no_trobat' });
  if (['cancelado', 'reembolsado'].includes(compra.estado_pago)) {
    return res.status(409).json({ error: 'operacio_no_aplicable' });
  }
  Compra.marcarCancelado(id);
  res.json(Compra.getById(id));
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

function exportarComprasCsv(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const files = Compra.listByEvento(eventoId).map((c) => ({
    ...c,
    importe_total_eur: (c.importe_total / 100).toFixed(2),
    quiere_factura_text: c.quiere_factura ? 'Sí' : 'No',
  }));

  const csv = toCsv(files, COLUMNES_CSV);
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
};
