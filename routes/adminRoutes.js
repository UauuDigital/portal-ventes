const express = require('express');
const router = express.Router();

const { login, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
} = require('../controllers/adminController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

router.get('/api/admin/eventos', requireAuth, llistarEventos);
router.get('/api/admin/eventos/:id', requireAuth, obtenirEvento);
router.post('/api/admin/eventos', requireAuth, crearEvento);
router.put('/api/admin/eventos/:id', requireAuth, actualitzarEvento);

module.exports = router;
