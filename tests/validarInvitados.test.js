const test = require('node:test');
const assert = require('node:assert/strict');

const { validarInvitados } = require('../utils/validarInvitados');

test('validarInvitados rebutja qualsevol cosa que no sigui una llista', () => {
  assert.deepEqual(validarInvitados(undefined), ['invitados ha de ser una llista']);
  assert.deepEqual(validarInvitados(null), ['invitados ha de ser una llista']);
  assert.deepEqual(validarInvitados('no'), ['invitados ha de ser una llista']);
});

test('validarInvitados rebutja una llista buida (cal almenys un convidat)', () => {
  assert.deepEqual(validarInvitados([]), ['cal almenys un convidat amb nom']);
});

test('validarInvitados accepta un convidat amb nom i sense càrrec', () => {
  assert.deepEqual(validarInvitados([{ nombre: 'Joana Puig' }]), []);
});

test('validarInvitados accepta diversos convidats vàlids', () => {
  assert.deepEqual(
    validarInvitados([
      { nombre: 'Joana Puig', cargo: 'Consellera' },
      { nombre: 'Marc Serra' },
    ]),
    []
  );
});

test('validarInvitados rebutja un convidat sense nom (buit o només espais)', () => {
  assert.deepEqual(validarInvitados([{ nombre: '' }]), ['convidat 1: falta el nom']);
  assert.deepEqual(validarInvitados([{ nombre: '   ' }]), ['convidat 1: falta el nom']);
  assert.deepEqual(validarInvitados([{ cargo: 'Consellera' }]), ['convidat 1: falta el nom']);
});

test('validarInvitados rebutja una entrada que no és un objecte', () => {
  assert.deepEqual(validarInvitados([null]), ['convidat 1: falta el nom']);
  assert.deepEqual(validarInvitados(['Joana Puig']), ['convidat 1: falta el nom']);
});

test('validarInvitados assenyala només l\'índex del convidat invàlid entre diversos', () => {
  assert.deepEqual(
    validarInvitados([{ nombre: 'Joana Puig' }, { nombre: '' }, { nombre: 'Marc Serra' }]),
    ['convidat 2: falta el nom']
  );
});
