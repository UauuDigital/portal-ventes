const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { login, logout } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
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
} = require('../controllers/adminController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

router.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ usuari: req.adminUser, rol: req.adminRol });
});

// Lectura: accessible per admin i pel rol de només visualització (Espai Econòmic)
router.get('/api/admin/eventos', requireRole('admin', 'viewer'), asyncHandler(llistarEventos));
router.get('/api/admin/eventos/:id', requireRole('admin', 'viewer'), asyncHandler(obtenirEvento));
router.get('/api/admin/eventos/:id/compras', requireRole('admin', 'viewer'), asyncHandler(llistarCompresEvento));

// Escriptura/gestió: només admin
router.post('/api/admin/eventos', requireRole('admin'), asyncHandler(crearEvento));
router.post('/api/admin/traduir-nom', requireRole('admin'), asyncHandler(traduirNom));
router.put('/api/admin/eventos/:id', requireRole('admin'), asyncHandler(actualitzarEvento));
router.delete('/api/admin/eventos/:id', requireRole('admin'), asyncHandler(eliminarEvento));
router.post('/api/admin/compras/:id/cancelar', requireRole('admin'), asyncHandler(cancelarCompra));
router.get('/api/admin/eventos/:id/compras/export.csv', requireRole('admin'), asyncHandler(exportarComprasCsv));
router.post('/api/admin/eventos/:id/email-prova', requireRole('admin'), asyncHandler(enviarEmailDePrueba));

module.exports = router;
