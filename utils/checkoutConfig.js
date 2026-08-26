// Minuts d'expiració de la sessió de Checkout de Stripe. Es defineix aquí,
// enlloc de duplicar la fórmula a stripeController.js i a Compra.js per
// separat, perquè RESERVA_MINUTES (Compra.js) ha de ser sempre >= aquest
// valor: si es desincronitzessin (com passava abans, amb RESERVA_MINUTES=15
// per defecte i una sessió de Stripe vigent fins als 30 minuts), una reserva
// "pendiente" deixaria de comptar com a ocupada abans que la seva sessió de
// Stripe hagués pogut expirar, permetent sobrevenda determinista: algú altre
// compra la plaça "alliberada" mentre el primer comprador encara pot pagar
// la seva.
//
// Stripe exigeix que expires_at sigui com a mínim 30 minuts després de crear
// la sessió de Checkout.
const EXPIRA_MINUTS = Math.max(30, parseInt(process.env.CHECKOUT_EXPIRES_MINUTES || '30', 10));

module.exports = { EXPIRA_MINUTS };
