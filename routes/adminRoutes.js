const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { login, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  eliminarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarComprasCsv,
} = require('../controllers/adminController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

router.get('/api/admin/eventos', requireAuth, asyncHandler(llistarEventos));
router.get('/api/admin/eventos/:id', requireAuth, asyncHandler(obtenirEvento));
router.post('/api/admin/eventos', requireAuth, asyncHandler(crearEvento));
router.put('/api/admin/eventos/:id', requireAuth, asyncHandler(actualitzarEvento));
router.delete('/api/admin/eventos/:id', requireAuth, asyncHandler(eliminarEvento));

router.get('/api/admin/eventos/:id/compras', requireAuth, asyncHandler(llistarCompresEvento));
router.post('/api/admin/compras/:id/cancelar', requireAuth, asyncHandler(cancelarCompra));
router.get('/api/admin/eventos/:id/compras/export.csv', requireAuth, asyncHandler(exportarComprasCsv));

module.exports = router;
