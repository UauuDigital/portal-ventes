const express = require('express');
const router = express.Router();

const { getEventoActual } = require('../controllers/eventoController');
const { crearCheckoutSession } = require('../controllers/stripeController');
const { checkoutLimiter } = require('../middleware/rateLimiter');

router.get('/api/evento/actual', getEventoActual);
router.post('/api/checkout/crear', checkoutLimiter, crearCheckoutSession);

module.exports = router;
