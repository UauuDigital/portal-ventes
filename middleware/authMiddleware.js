const { verificarCookieSessio } = require('../utils/sessionCookie');

function llegirSessio(req) {
  const capçalera = req.headers.cookie || '';
  const match = capçalera.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return null;
  return verificarCookieSessio(decodeURIComponent(match[1]));
}

function requireAuth(req, res, next) {
  const sessio = llegirSessio(req);
  if (!sessio) return res.status(401).json({ error: 'no_autenticat' });
  req.adminUser = sessio.usuari;
  next();
}

function requireAuthPage(req, res, next) {
  const sessio = llegirSessio(req);
  if (!sessio) return res.redirect('/admin/login.html');
  req.adminUser = sessio.usuari;
  next();
}

module.exports = { requireAuth, requireAuthPage };
