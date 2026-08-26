const crypto = require('node:crypto');
const { crearCookieSessio } = require('../utils/sessionCookie');

const VUIT_HORES_MS = 8 * 60 * 60 * 1000;

// Sense ADMIN_USER/ADMIN_PASS no hi ha manera de comparar-hi res: fallar aquí
// (igual que config/db.js amb DATABASE_URL) evita que un desplegament amb
// aquestes variables oblidades arrenqui igualment i, per culpa del bug que
// arregla safeEqual just a sota, accepti login com a admin amb usuari i
// contrasenya buits.
if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  throw new Error(
    'Falten ADMIN_USER/ADMIN_PASS a l\'entorn: calen credencials d\'administrador no buides per arrencar.'
  );
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // Dos buffers buits són "iguals" per a timingSafeEqual: sense aquest tall,
  // un usuari/contrasenya buits contra un ADMIN_USER/ADMIN_PASS també buits
  // autenticarien com a admin. Amb la validació d'arrencada d'aquí dalt ja no
  // hauria de poder passar mai, però és la comprovació correcta igualment.
  if (bufA.length === 0 || bufB.length === 0) return false;
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function login(req, res) {
  const { usuari, contrasenya } = req.body || {};

  const esAdmin =
    safeEqual(usuari || '', process.env.ADMIN_USER || '') &&
    safeEqual(contrasenya || '', process.env.ADMIN_PASS || '');
  const esViewer =
    !esAdmin &&
    process.env.VIEWER_USER &&
    process.env.VIEWER_PASS &&
    safeEqual(usuari || '', process.env.VIEWER_USER) &&
    safeEqual(contrasenya || '', process.env.VIEWER_PASS);

  if (!esAdmin && !esViewer) {
    return res.status(401).json({ error: 'credencials_invalides' });
  }

  const rol = esAdmin ? 'admin' : 'viewer';
  const nomUsuari = esAdmin ? process.env.ADMIN_USER : process.env.VIEWER_USER;
  const valor = crearCookieSessio(nomUsuari, rol);
  res.cookie('admin_session', valor, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VUIT_HORES_MS,
  });
  res.json({ ok: true, rol });
}

function logout(req, res) {
  res.clearCookie('admin_session');
  res.json({ ok: true });
}

module.exports = { login, logout, safeEqual };
