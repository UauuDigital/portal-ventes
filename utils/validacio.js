// Regex compartides entre validacions de diferents parts del checkout
// (comprador a stripeController.js, acompanyants a
// utils/validarAcompanyants.js), perquè totes exigeixin exactament el
// mateix format sense arriscar-se a divergir amb còpies soltes.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { EMAIL_REGEX };
