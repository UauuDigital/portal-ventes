const crypto = require('node:crypto');

const HORES_EXPIRACIO = 8;

function firmar(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta SESSION_SECRET a .env');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function crearCookieSessio(usuari) {
  const exp = Date.now() + HORES_EXPIRACIO * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ usuari, exp })).toString('base64url');
  const signatura = firmar(payload);
  return `${payload}.${signatura}`;
}

function verificarCookieSessio(valor) {
  if (!valor || typeof valor !== 'string' || !valor.includes('.')) return null;

  const [payload, signatura] = valor.split('.');
  if (!payload || !signatura) return null;

  const esperada = firmar(payload);
  const bufEsperada = Buffer.from(esperada);
  const bufRebuda = Buffer.from(signatura);
  if (bufEsperada.length !== bufRebuda.length || !crypto.timingSafeEqual(bufEsperada, bufRebuda)) {
    return null;
  }

  let dades;
  try {
    dades = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!dades.usuari || !dades.exp || Date.now() > dades.exp) return null;
  return { usuari: dades.usuari };
}

module.exports = { crearCookieSessio, verificarCookieSessio };
