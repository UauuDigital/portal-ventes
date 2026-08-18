const crypto = require('node:crypto');
const { crearCookieSessio } = require('../utils/sessionCookie');

const VUIT_HORES_MS = 8 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
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

module.exports = { login, logout };
