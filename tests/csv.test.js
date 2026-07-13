const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv } = require('../utils/csv');

const columnes = [
  { clau: 'nom', capsalera: 'Nom' },
  { clau: 'importe', capsalera: 'Import' },
];

test('genera capçalera i files simples', () => {
  const csv = toCsv([{ nom: 'Anna', importe: '35.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\nAnna,35.00\r\n');
});

test('escapa camps amb comes entre cometes dobles', () => {
  const csv = toCsv([{ nom: 'Cognom, Nom', importe: '10.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\n"Cognom, Nom",10.00\r\n');
});

test('escapa cometes dobles duplicant-les', () => {
  const csv = toCsv([{ nom: 'Dit "el Petit"', importe: '10.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\n"Dit ""el Petit""",10.00\r\n');
});

test('tracta null/undefined com a camp buit', () => {
  const csv = toCsv([{ nom: null, importe: undefined }], columnes);
  assert.equal(csv, 'Nom,Import\r\n,\r\n');
});

test('sense files retorna només la capçalera', () => {
  const csv = toCsv([], columnes);
  assert.equal(csv, 'Nom,Import\r\n');
});
