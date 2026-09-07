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

// Limita els intents de login de l'admin per frenar força bruta contra
// ADMIN_USER/ADMIN_PASS i VIEWER_USER/VIEWER_PASS. Més estricte que
// checkoutLimiter perquè aquí no hi ha cap motiu legítim per fer moltes
// peticions seguides des de la mateixa IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'massa_peticions',
    detalls: 'Has fet massa intents. Torna-ho a provar en uns minuts.',
  },
});

module.exports = { checkoutLimiter, loginLimiter };
