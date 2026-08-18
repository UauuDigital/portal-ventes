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
  req.adminRol = sessio.rol;
  next();
}

function requireAuthPage(req, res, next) {
  const sessio = llegirSessio(req);
  if (!sessio) return res.redirect('/admin/login.html');
  req.adminUser = sessio.usuari;
  req.adminRol = sessio.rol;
  next();
}

function requireRole(...rolsPermesos) {
  return (req, res, next) => {
    const sessio = llegirSessio(req);
    if (!sessio) return res.status(401).json({ error: 'no_autenticat' });
    if (!rolsPermesos.includes(sessio.rol)) {
      return res.status(403).json({ error: 'sense_permisos' });
    }
    req.adminUser = sessio.usuari;
    req.adminRol = sessio.rol;
    next();
  };
}

function teSessioValida(req) {
  return !!llegirSessio(req);
}

function rolSessio(req) {
  const sessio = llegirSessio(req);
  return sessio ? sessio.rol : null;
}

module.exports = { requireAuth, requireAuthPage, requireRole, teSessioValida, rolSessio };
