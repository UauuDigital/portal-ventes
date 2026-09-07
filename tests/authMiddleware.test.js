const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// authMiddleware.js només importa utils/sessionCookie.js (verificarCookieSessio),
// que exigeix SESSION_SECRET al firmar/verificar. Cal definir-la abans del
// require, igual que fa tests/sessionCookie.test.js. El middleware no importa
// config/db ni cap model: no cal BD real per a aquest fitxer.
process.env.SESSION_SECRET = 'secret-de-proves-nomes-per-tests';

const { requireRole } = require('../middleware/authMiddleware');
const { crearCookieSessio } = require('../utils/sessionCookie');

// --- Helpers per simular req/res/next sense aixecar Express ---

function crearReqAmbCookie(valorCookie) {
  return {
    headers: {
      cookie: valorCookie == null ? '' : `admin_session=${encodeURIComponent(valorCookie)}`,
    },
  };
}

function crearResMock() {
  const res = {
    statusCode: null,
    body: null,
    status(codi) {
      res.statusCode = codi;
      return res;
    },
    json(dades) {
      res.body = dades;
      return res;
    },
  };
  return res;
}

function crearNextMock() {
  const next = () => {
    next.cridat = true;
  };
  next.cridat = false;
  return next;
}

// Construeix una cookie de sessió amb un `exp` custom (en el passat), signada
// correctament amb el mateix mecanisme que utils/sessionCookie.js. Cal fer-ho
// a mà perquè crearCookieSessio() sempre calcula exp = ara + 8 hores, sense
// permetre passar-hi una data d'expiració pròpia.
function crearCookieExpirada(usuari, rol) {
  const payload = Buffer.from(
    JSON.stringify({ usuari, rol, exp: Date.now() - 1000 })
  ).toString('base64url');
  const signatura = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signatura}`;
}

// --- Cas 1 i 2: ruta protegida amb requireRole('admin') (com POST /api/admin/eventos a routes/adminRoutes.js) ---

test("requireRole('admin') rebutja un viewer vàlid amb 403 sense_permisos", () => {
  const cookieViewer = crearCookieSessio('viewer-proves', 'viewer');
  const req = crearReqAmbCookie(cookieViewer);
  const res = crearResMock();
  const next = crearNextMock();

  requireRole('admin')(req, res, next);

  assert.equal(next.cridat, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'sense_permisos' });
});

test("requireRole('admin') accepta un admin vàlid i crida next() sense respondre error", () => {
  const cookieAdmin = crearCookieSessio('admin-proves', 'admin');
  const req = crearReqAmbCookie(cookieAdmin);
  const res = crearResMock();
  const next = crearNextMock();

  requireRole('admin')(req, res, next);

  assert.equal(next.cridat, true);
  assert.equal(res.statusCode, null);
  assert.equal(req.adminUser, 'admin-proves');
  assert.equal(req.adminRol, 'admin');
});

// --- Cas 3: ruta protegida amb requireRole('admin', 'viewer') (com GET /api/admin/eventos) ---

test("requireRole('admin', 'viewer') accepta tant un admin com un viewer vàlids", () => {
  const cookieAdmin = crearCookieSessio('admin-proves', 'admin');
  const reqAdmin = crearReqAmbCookie(cookieAdmin);
  const resAdmin = crearResMock();
  const nextAdmin = crearNextMock();
  requireRole('admin', 'viewer')(reqAdmin, resAdmin, nextAdmin);
  assert.equal(nextAdmin.cridat, true);
  assert.equal(resAdmin.statusCode, null);

  const cookieViewer = crearCookieSessio('viewer-proves', 'viewer');
  const reqViewer = crearReqAmbCookie(cookieViewer);
  const resViewer = crearResMock();
  const nextViewer = crearNextMock();
  requireRole('admin', 'viewer')(reqViewer, resViewer, nextViewer);
  assert.equal(nextViewer.cridat, true);
  assert.equal(resViewer.statusCode, null);
});

// --- Cas 4: sense cookie de sessió en absolut ---

test('requireRole rebutja una petició sense cap cookie de sessió amb 401 no_autenticat', () => {
  const req = crearReqAmbCookie(null);
  const res = crearResMock();
  const next = crearNextMock();

  requireRole('admin', 'viewer')(req, res, next);

  assert.equal(next.cridat, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'no_autenticat' });
});

// --- Cas 5: cookie present però amb signatura manipulada (no absent) ---

test('requireRole rebutja una cookie present amb signatura manipulada amb 401 no_autenticat', () => {
  const cookieValida = crearCookieSessio('admin-proves', 'admin');
  const [payload] = cookieValida.split('.');
  const cookieManipulada = `${payload}.signaturafalsa`;
  const req = crearReqAmbCookie(cookieManipulada);
  // La cookie hi és realment present a la capçalera: no és el cas "sense cookie".
  assert.ok(req.headers.cookie.includes('admin_session='));
  const res = crearResMock();
  const next = crearNextMock();

  requireRole('admin', 'viewer')(req, res, next);

  assert.equal(next.cridat, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'no_autenticat' });
});

// --- Cas 6: cookie de sessió caducada (exp en el passat) ---

test('requireRole rebutja una cookie caducada amb 401 no_autenticat', () => {
  const cookieCaducada = crearCookieExpirada('admin-proves', 'admin');
  const req = crearReqAmbCookie(cookieCaducada);
  const res = crearResMock();
  const next = crearNextMock();

  requireRole('admin', 'viewer')(req, res, next);

  assert.equal(next.cridat, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'no_autenticat' });
});
