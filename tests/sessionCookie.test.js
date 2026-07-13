const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'secret-de-proves-nomes-per-tests';

const { crearCookieSessio, verificarCookieSessio } = require('../utils/sessionCookie');

test('crea i verifica una cookie vàlida', () => {
  const cookie = crearCookieSessio('admin');
  const dades = verificarCookieSessio(cookie);
  assert.deepEqual(dades, { usuari: 'admin' });
});

test('rebutja una cookie amb signatura manipulada', () => {
  const cookie = crearCookieSessio('admin');
  const [payload] = cookie.split('.');
  const manipulada = `${payload}.signaturafalsa`;
  assert.equal(verificarCookieSessio(manipulada), null);
});

test('rebutja una cookie amb payload manipulat', () => {
  const cookie = crearCookieSessio('admin');
  const [, signatura] = cookie.split('.');
  const payloadFals = Buffer.from(JSON.stringify({ usuari: 'algu-altre', exp: Date.now() + 100000 })).toString('base64url');
  assert.equal(verificarCookieSessio(`${payloadFals}.${signatura}`), null);
});

test('rebutja una cookie expirada', () => {
  const payloadExpirat = Buffer.from(JSON.stringify({ usuari: 'admin', exp: Date.now() - 1000 })).toString('base64url');
  const crypto = require('node:crypto');
  const signatura = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payloadExpirat).digest('base64url');
  assert.equal(verificarCookieSessio(`${payloadExpirat}.${signatura}`), null);
});

test('rebutja valors mal formats', () => {
  assert.equal(verificarCookieSessio(''), null);
  assert.equal(verificarCookieSessio('nopunt'), null);
  assert.equal(verificarCookieSessio(null), null);
});
