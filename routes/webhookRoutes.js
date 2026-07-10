const express = require('express');
const router = express.Router();

const { webhook } = require('../controllers/stripeController');

// Important: express.raw (no express.json) perquè Stripe necessita el body
// exacte en brut per poder verificar la signatura de l'esdeveniment.
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhook);

module.exports = router;
