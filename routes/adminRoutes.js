const express = require('express');
const router = express.Router();

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

router.get('/api/admin/eventos', requireAuth, llistarEventos);
router.get('/api/admin/eventos/:id', requireAuth, obtenirEvento);
router.post('/api/admin/eventos', requireAuth, crearEvento);
router.put('/api/admin/eventos/:id', requireAuth, actualitzarEvento);
router.delete('/api/admin/eventos/:id', requireAuth, eliminarEvento);

router.get('/api/admin/eventos/:id/compras', requireAuth, llistarCompresEvento);
router.post('/api/admin/compras/:id/cancelar', requireAuth, cancelarCompra);
router.get('/api/admin/eventos/:id/compras/export.csv', requireAuth, exportarComprasCsv);

module.exports = router;
