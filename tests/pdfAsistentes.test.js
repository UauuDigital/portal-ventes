const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const PDFDocument = require('pdfkit');
const { escriureAsistentsPdf, aplanarAssistents } = require('../utils/pdfAsistentes');

// Recull tot el que s'escriu a un PDFDocument en un únic Buffer, per poder
// comprovar que el resultat és un PDF real sense haver de fer pipe cap a
// una resposta HTTP (que no existeix en un test unitari).
function generarBuffer(doc) {
  return new Promise((resolve, reject) => {
    const trossos = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        trossos.push(chunk);
        cb();
      },
    });
    sink.on('finish', () => resolve(Buffer.concat(trossos)));
    sink.on('error', reject);
    doc.pipe(sink);
    doc.end();
  });
}

const EVENTO = { nombre: '[TEST] Sopar de prova', fecha: '2026-09-05T20:00:00.000Z' };

test('aplanarAssistents: una compra sense acompanyants dona una sola fila (el comprador)', () => {
  const compres = [
    { nombre_comprador: 'Anna Roig', email: 'anna@example.com', telefono: '+34 600000000', estado_pago: 'pagado', acompanyants: [] },
  ];
  const assistents = aplanarAssistents(compres);
  assert.equal(assistents.length, 1);
  assert.equal(assistents[0].nombre, 'Anna Roig');
  assert.equal(assistents[0].estado_pago, 'pagado');
});

test('aplanarAssistents: comprador + acompanyants es aplanen en files iguals, sense distinció', () => {
  const compres = [
    {
      nombre_comprador: 'Anna Roig', email: 'anna@example.com', telefono: '+34 600000000', estado_pago: 'pagado',
      acompanyants: [
        { nombre: 'Bernat Puig', email: 'bernat@example.com', telefono: '+34 611111111' },
        { nombre: 'Clara Vidal', email: 'clara@example.com', telefono: null },
      ],
    },
  ];
  const assistents = aplanarAssistents(compres);
  assert.equal(assistents.length, 3);
  // Cap camp que distingeixi "és comprador" — totes les files tenen
  // exactament les mateixes claus (nombre, email, telefono, estado_pago).
  assistents.forEach((a) => {
    assert.deepEqual(Object.keys(a).sort(), ['email', 'estado_pago', 'nombre', 'telefono']);
  });
  // L'acompanyant hereta l'estat de pagament de la seva compra.
  assert.equal(assistents[1].estado_pago, 'pagado');
  assert.equal(assistents[2].estado_pago, 'pagado');
});

test('aplanarAssistents: múltiples compres s\'aplanen totes juntes, cadascuna amb el seu propi estat', () => {
  const compres = [
    { nombre_comprador: 'Anna Roig', email: 'anna@example.com', telefono: null, estado_pago: 'pagado', acompanyants: [] },
    {
      nombre_comprador: 'David Serra', email: 'david@example.com', telefono: null, estado_pago: 'pendiente',
      acompanyants: [{ nombre: 'Eva Marti', email: 'eva@example.com', telefono: null }],
    },
  ];
  const assistents = aplanarAssistents(compres);
  assert.equal(assistents.length, 3);
  assert.equal(assistents[0].estado_pago, 'pagado');
  assert.equal(assistents[1].estado_pago, 'pendiente');
  assert.equal(assistents[2].estado_pago, 'pendiente'); // acompanyant d'en David
});

test('escriureAsistentsPdf: genera un PDF vàlid (capçalera %PDF) amb assistents', async () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const compres = [
    {
      nombre_comprador: 'Anna Roig', email: 'anna@example.com', telefono: '+34 600000000', estado_pago: 'pagado',
      acompanyants: [{ nombre: 'Bernat Puig', email: 'bernat@example.com', telefono: '+34 611111111' }],
    },
  ];
  escriureAsistentsPdf(doc, { evento: EVENTO, compres, incloureEstat: false });
  const buffer = await generarBuffer(doc);
  assert.ok(buffer.length > 0, 'el PDF no hauria de quedar buit');
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('escriureAsistentsPdf: no llança amb zero assistents (llista buida, cap compra)', async () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  escriureAsistentsPdf(doc, { evento: EVENTO, compres: [], incloureEstat: false });
  const buffer = await generarBuffer(doc);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('escriureAsistentsPdf: amb incloureEstat=true genera igualment un PDF vàlid', async () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const compres = [
    { nombre_comprador: 'Anna Roig', email: 'anna@example.com', telefono: null, estado_pago: 'pendiente', acompanyants: [] },
  ];
  escriureAsistentsPdf(doc, { evento: EVENTO, compres, incloureEstat: true });
  const buffer = await generarBuffer(doc);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('escriureAsistentsPdf: un llistat llarg que ocupa diverses pàgines no llança', async () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const compres = Array.from({ length: 60 }, (_, i) => ({
    nombre_comprador: `Assistent ${i}`, email: `assistent${i}@example.com`, telefono: null, estado_pago: 'pagado', acompanyants: [],
  }));
  escriureAsistentsPdf(doc, { evento: EVENTO, compres, incloureEstat: false });
  const buffer = await generarBuffer(doc);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  // Un PDF de diverses pàgines és sensiblement més gran que un d'una sola.
  assert.ok(buffer.length > 2000);
});
