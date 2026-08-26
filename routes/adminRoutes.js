const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { login, logout } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');
const { migrarInvitados } = require('../scripts/migrar-invitados');
const {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  eliminarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarComprasCsv,
  traduirNom,
  enviarEmailDePrueba,
  llistarHistorial,
} = require('../controllers/adminController');

router.post('/admin/login', loginLimiter, login);
router.post('/admin/logout', logout);

router.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ usuari: req.adminUser, rol: req.adminRol });
});

// Lectura: accessible per admin i pel rol de només visualització (Espai Econòmic)
router.get('/api/admin/eventos', requireRole('admin', 'viewer'), asyncHandler(llistarEventos));
router.get('/api/admin/eventos/:id', requireRole('admin', 'viewer'), asyncHandler(obtenirEvento));
router.get('/api/admin/eventos/:id/compras', requireRole('admin', 'viewer'), asyncHandler(llistarCompresEvento));
router.get('/api/admin/historial', requireRole('admin', 'viewer'), asyncHandler(llistarHistorial));

// Escriptura/gestió: només admin
router.post('/api/admin/eventos', requireRole('admin'), asyncHandler(crearEvento));
router.post('/api/admin/traduir-nom', requireRole('admin'), asyncHandler(traduirNom));
router.put('/api/admin/eventos/:id', requireRole('admin'), asyncHandler(actualitzarEvento));
router.delete('/api/admin/eventos/:id', requireRole('admin'), asyncHandler(eliminarEvento));
router.post('/api/admin/compras/:id/cancelar', requireRole('admin'), asyncHandler(cancelarCompra));
router.get('/api/admin/eventos/:id/compras/export.csv', requireRole('admin'), asyncHandler(exportarComprasCsv));
router.post('/api/admin/eventos/:id/email-prova', requireRole('admin'), asyncHandler(enviarEmailDePrueba));

// TEMPORAL - eliminar tras ejecutar la migración una vez en producción
// (Plesk no hereda DATABASE_URL en "Ejecutar comandos Node.js"/"Ejecutar
// Script"; reutilitza la connexió ja viva del servidor. Escriptura sobre
// dades, encara que idempotent: només admin, no viewer.)
router.post('/admin/migrar-invitados-temp', requireRole('admin'), asyncHandler(async (req, res) => {
  const resum = await migrarInvitados();
  res.json(resum);
}));

module.exports = router;
