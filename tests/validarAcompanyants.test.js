const test = require('node:test');
const assert = require('node:assert/strict');

const { validarAcompanyants } = require('../utils/validarAcompanyants');

test('validarAcompanyants rebutja qualsevol cosa que no sigui una llista', () => {
  assert.deepEqual(validarAcompanyants(undefined, 3), ['acompanyants ha de ser una llista']);
  assert.deepEqual(validarAcompanyants(null, 3), ['acompanyants ha de ser una llista']);
  assert.deepEqual(validarAcompanyants('no', 3), ['acompanyants ha de ser una llista']);
});

test('validarAcompanyants exigeix exactament cantidad - 1 acompanyants', () => {
  assert.deepEqual(
    validarAcompanyants([{ nombre: 'Joana Puig', email: 'joana@example.com' }], 3),
    ["calen exactament 2 acompanyants (n'hi ha 1)"]
  );
  assert.deepEqual(validarAcompanyants([], 3), ["calen exactament 2 acompanyants (n'hi ha 0)"]);
  assert.deepEqual(
    validarAcompanyants(
      [
        { nombre: 'Joana Puig', email: 'joana@example.com' },
        { nombre: 'Marc Serra', email: 'marc@example.com' },
        { nombre: 'Anna Roig', email: 'anna@example.com' },
      ],
      3
    ),
    ["calen exactament 2 acompanyants (n'hi ha 3)"]
  );
});

test('validarAcompanyants pluralitza correctament el missatge quan en cal només 1', () => {
  assert.deepEqual(validarAcompanyants([], 2), ["calen exactament 1 acompanyant (n'hi ha 0)"]);
});

test('validarAcompanyants accepta la llista quan el nombre i les dades són correctes', () => {
  assert.deepEqual(
    validarAcompanyants(
      [
        { nombre: 'Joana Puig', email: 'joana@example.com' },
        { nombre: 'Marc Serra', email: 'marc@example.com', telefono: '+34611222333' },
      ],
      3
    ),
    []
  );
});

test('validarAcompanyants accepta un acompanyant sense telèfon (opcional)', () => {
  assert.deepEqual(validarAcompanyants([{ nombre: 'Joana Puig', email: 'joana@example.com' }], 2), []);
});

test('validarAcompanyants rebutja un acompanyant sense nom', () => {
  assert.deepEqual(
    validarAcompanyants([{ email: 'joana@example.com' }], 2),
    ['acompanyant 1: falta el nom']
  );
  assert.deepEqual(
    validarAcompanyants([{ nombre: '   ', email: 'joana@example.com' }], 2),
    ['acompanyant 1: falta el nom']
  );
});

test('validarAcompanyants rebutja un acompanyant amb email invàlid o absent', () => {
  assert.deepEqual(
    validarAcompanyants([{ nombre: 'Joana Puig', email: 'no-es-un-email' }], 2),
    ['acompanyant 1: email invàlid']
  );
  assert.deepEqual(
    validarAcompanyants([{ nombre: 'Joana Puig' }], 2),
    ['acompanyant 1: email invàlid']
  );
});

test('validarAcompanyants rebutja una entrada que no és un objecte', () => {
  assert.deepEqual(validarAcompanyants([null], 2), ['acompanyant 1: dades invàlides']);
  assert.deepEqual(validarAcompanyants(['Joana Puig'], 2), ['acompanyant 1: dades invàlides']);
});

test('validarAcompanyants assenyala només l\'índex de l\'acompanyant invàlid entre diversos', () => {
  assert.deepEqual(
    validarAcompanyants(
      [
        { nombre: 'Joana Puig', email: 'joana@example.com' },
        { nombre: '', email: 'marc@example.com' },
      ],
      3
    ),
    ['acompanyant 2: falta el nom']
  );
});
