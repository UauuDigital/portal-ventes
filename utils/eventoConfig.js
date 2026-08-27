// Aforament i preu de tots els esdeveniments: constants fixes de
// l'aplicació, ja no editables des de l'admin (decisió de negoci: cada
// esdeveniment d'Espai Econòmic té sempre el mateix aforament i preu). Es
// defineixen aquí, no com a números màgics dins adminController.js, perquè
// s'han d'aplicar exactament igual tant en crear com en editar un
// esdeveniment (mateix patró que EXPIRA_MINUTS a checkoutConfig.js).
const AFORAMENT_FIX = 50;
// Cèntims, mateixa unitat que la columna `precio` d'eventos i que la resta
// de l'app (formatEuros a public/js/admin.js i utils/mailer.js): 70,00 €.
const PREU_FIX_CENTIMS = 7000;

module.exports = { AFORAMENT_FIX, PREU_FIX_CENTIMS };
