const test = require('node:test');
const assert = require('node:assert/strict');

// authController.js exigeix ADMIN_USER/ADMIN_PASS a l'arrencada (llança si
// falten): cal definir-les abans del require, igual que sessionCookie.test.js
// fa amb SESSION_SECRET.
process.env.ADMIN_USER = 'admin-de-proves';
process.env.ADMIN_PASS = 'contrasenya-de-proves';

const { safeEqual } = require('../controllers/authController');

test('safeEqual accepta dos valors idèntics', () => {
  assert.equal(safeEqual('abc123', 'abc123'), true);
});

test('safeEqual rebutja valors diferents de la mateixa longitud', () => {
  assert.equal(safeEqual('abc123', 'xyz789'), false);
});

test('safeEqual rebutja valors de longitud diferent', () => {
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('safeEqual rebutja dos valors buits (bypass amb credencials buides)', () => {
  assert.equal(safeEqual('', ''), false);
});

test('safeEqual rebutja un valor buit contra un de no buit', () => {
  assert.equal(safeEqual('', 'abc'), false);
  assert.equal(safeEqual('abc', ''), false);
});
