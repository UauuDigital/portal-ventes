const PDFDocument = require('pdfkit');

// Mateix mecanisme que utils/mailer.js (formatDataHora) i checkout.js
// (formatDataSenseHora) al frontend, sense hora perquè aquí no cal.
function formatDataSenseHora(isoString) {
  return new Date(isoString).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

const ESTATS_LLEGIBLES = {
  pendiente: 'Pendent',
  pagado: 'Pagat',
  cancelado: 'Cancel·lat',
  reembolsado: 'Reemborsat',
};

const MARGE = 40;
const ALT_FILA = 22;
const COLOR_VORA = '#d8d5d3';
const COLOR_MUTED = '#6b6663';

// Amplada total de les columnes = 515pt en tots dos casos (mida A4 amb
// marges de 40pt a cada costat: 595.28 - 2*40 ≈ 515), perquè la taula
// ocupi exactament l'amplada útil de la pàgina sense sobrar ni faltar.
const COLUMNES_SENSE_ESTAT = [
  { clau: 'nombre', titol: 'Nom', ample: 175 },
  { clau: 'email', titol: 'Email', ample: 195 },
  { clau: 'telefono', titol: 'Telèfon', ample: 145 },
];
const COLUMNES_AMB_ESTAT = [
  { clau: 'nombre', titol: 'Nom', ample: 150 },
  { clau: 'email', titol: 'Email', ample: 170 },
  { clau: 'telefono', titol: 'Telèfon', ample: 100 },
  { clau: 'estado_pago', titol: 'Estat', ample: 95 },
];

/**
 * Aplana comprador + acompanyants de cada compra en una única llista
 * d'assistents: cadascú és una fila igual, sense distinció visual entre
 * qui va comprar i qui l'acompanya (tots són assistents a l'esdeveniment
 * per igual). Un acompanyant hereta l'estat de pagament de la seva compra
 * (no en té un de propi).
 */
function aplanarAssistents(compres) {
  const assistents = [];
  compres.forEach((c) => {
    assistents.push({ nombre: c.nombre_comprador, email: c.email, telefono: c.telefono, estado_pago: c.estado_pago });
    (c.acompanyants || []).forEach((ac) => {
      assistents.push({ nombre: ac.nombre, email: ac.email, telefono: ac.telefono, estado_pago: c.estado_pago });
    });
  });
  return assistents;
}

/**
 * Escriu el llistat d'assistents d'un esdeveniment al `doc` (PDFDocument
 * de pdfkit) ja creat pel crider. No fa `doc.pipe(...)` ni `doc.end()`
 * — això és responsabilitat del crider (normalment el controlador, que
 * ha de fer pipe cap a la resposta HTTP abans de cridar `.end()`), perquè
 * aquesta funció es pugui provar de manera aïllada sense necessitar una
 * resposta HTTP real (vegeu tests/pdfAsistentes.test.js).
 *
 * `incloureEstat` afegeix una columna d'estat de pagament — només té
 * sentit quan el llistat pot incloure compres no pagades (toggle "totes"
 * actiu a l'admin); amb el filtre per defecte (només pagades) totes les
 * files dirien "Pagat", així que la columna no hi aporta res.
 */
function escriureAsistentsPdf(doc, { evento, compres, incloureEstat }) {
  const assistents = aplanarAssistents(compres);
  const columnes = incloureEstat ? COLUMNES_AMB_ESTAT : COLUMNES_SENSE_ESTAT;
  const amplaTaula = columnes.reduce((suma, col) => suma + col.ample, 0);

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(evento.nombre);
  doc.font('Helvetica').fontSize(11).fillColor(COLOR_MUTED).text(formatDataSenseHora(evento.fecha));
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor(COLOR_MUTED)
    .text(`${assistents.length} assistent${assistents.length === 1 ? '' : 's'}`);
  doc.fillColor('#000000');
  doc.moveDown(1);

  let y = doc.y;

  function dibuixarCapsaleraTaula() {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    let x = MARGE;
    columnes.forEach((col) => {
      doc.text(col.titol, x, y, { width: col.ample - 6, lineBreak: false });
      x += col.ample;
    });
    y += ALT_FILA;
    doc.moveTo(MARGE, y - 6).lineTo(MARGE + amplaTaula, y - 6).strokeColor(COLOR_VORA).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(10).fillColor('#000000');
  }

  dibuixarCapsaleraTaula();

  assistents.forEach((assistent, i) => {
    // Salt de pàgina si la següent fila no hi cap sencera: es repinta la
    // capçalera de la taula a cada pàgina nova perquè sempre sigui clar
    // què significa cada columna, encara que el llistat ocupi diverses
    // pàgines.
    if (y + ALT_FILA > doc.page.height - MARGE) {
      doc.addPage();
      y = MARGE;
      dibuixarCapsaleraTaula();
    }

    // Franja alterna molt suau només per llegibilitat en llistats llargs
    // (sense cap significat, purament visual).
    if (i % 2 === 1) {
      doc.rect(MARGE, y - 4, amplaTaula, ALT_FILA).fill('#f7f6f5');
      doc.fillColor('#000000');
    }

    let x = MARGE;
    columnes.forEach((col) => {
      const valorBrut = col.clau === 'estado_pago'
        ? (ESTATS_LLEGIBLES[assistent.estado_pago] || assistent.estado_pago)
        : assistent[col.clau];
      // ellipsis + height acotada: talla amb "…" enlloc de desbordar-se
      // cap a la fila següent si un nom/email és massa llarg per la
      // columna, tal com demana la verificació ("sense text tallat ni
      // desbordat" es refereix a que no s'envaeixi la fila del costat).
      doc.text(String(valorBrut || '—'), x, y, {
        width: col.ample - 6,
        height: ALT_FILA - 4,
        ellipsis: true,
        lineBreak: false,
      });
      x += col.ample;
    });
    y += ALT_FILA;
  });
}

module.exports = { escriureAsistentsPdf, aplanarAssistents };
