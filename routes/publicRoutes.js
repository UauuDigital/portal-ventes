const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { getEventoActual, getEventosActius } = require('../controllers/eventoController');
const { crearCheckoutSession, cancelarCheckoutSession, obtenerConfirmacion } = require('../controllers/stripeController');
const { checkoutLimiter } = require('../middleware/rateLimiter');

router.get('/api/evento/actual', asyncHandler(getEventoActual));
router.get('/api/evento/actius', asyncHandler(getEventosActius));
router.post('/api/checkout/crear', checkoutLimiter, asyncHandler(crearCheckoutSession));
router.post('/api/checkout/cancelar', asyncHandler(cancelarCheckoutSession));
router.get('/api/checkout/confirmacion/:session_id', asyncHandler(obtenerConfirmacion));

module.exports = router;
