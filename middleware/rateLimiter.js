const rateLimit = require('express-rate-limit');

// Limita l'endpoint de creació de Checkout Session per evitar abús
// (creació massiva de compres "pendiente" que bloquegin aforament).
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'massa_peticions',
    detalls: 'Has fet massa peticions. Torna-ho a provar en uns minuts.',
  },
});

module.exports = { checkoutLimiter };
