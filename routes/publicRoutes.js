const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const { getEventoActual, getEventosActius } = require('../controllers/eventoController');
const { crearCheckoutSession, cancelarCheckoutSession, obtenerConfirmacion } = require('../controllers/stripeController');
const { obtenerMisDatos, actualizarMisDatos } = require('../controllers/misDatosController');
const { checkoutLimiter } = require('../middleware/rateLimiter');

router.get('/api/evento/actual', asyncHandler(getEventoActual));
router.get('/api/evento/actius', asyncHandler(getEventosActius));
router.post('/api/checkout/crear', checkoutLimiter, asyncHandler(crearCheckoutSession));
router.post('/api/checkout/cancelar', asyncHandler(cancelarCheckoutSession));
router.get('/api/checkout/confirmacion/:session_id', asyncHandler(obtenerConfirmacion));
router.get('/api/mis-datos/:token', asyncHandler(obtenerMisDatos));
router.put('/api/mis-datos/:token', asyncHandler(actualizarMisDatos));

module.exports = router;
