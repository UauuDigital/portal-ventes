// Aforament i preu de tots els esdeveniments: constants fixes de
// l'aplicació, ja no editables des de l'admin (decisió de negoci: cada
// esdeveniment d'Espai Econòmic té sempre el mateix aforament i preu). Es
// defineixen aquí, no com a números màgics dins adminController.js, perquè
// s'han d'aplicar exactament igual tant en crear com en editar un
// esdeveniment (mateix patró que EXPIRA_MINUTS a checkoutConfig.js).
const AFORAMENT_FIX = 50;
// Cèntims, mateixa unitat que la columna `precio` d'eventos i que la resta
// de l'app (formatEuros a public/js/admin.js i utils/mailer.js): 65,00 €.
const PREU_FIX_CENTIMS = 6500;

// Data límit de compra: també fixa, ja no editable des de l'admin. Sempre
// aquestes hores abans de la data de l'esdeveniment, sense excepció.
const HORES_LIMIT_COMPRA = 48;

/**
 * Calcula fecha_limite_compra a partir de la data de l'esdeveniment: sempre
 * HORES_LIMIT_COMPRA hores abans. Accepta qualsevol valor vàlid per a
 * `new Date(...)` (ISO string o Date) i retorna un ISO string, la mateixa
 * representació que fa servir la resta de l'app per a les dates d'eventos.
 */
function calcularFechaLimiteCompra(fechaEvento) {
  return new Date(new Date(fechaEvento).getTime() - HORES_LIMIT_COMPRA * 3600 * 1000).toISOString();
}

module.exports = { AFORAMENT_FIX, PREU_FIX_CENTIMS, HORES_LIMIT_COMPRA, calcularFechaLimiteCompra };
