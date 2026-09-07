const { EMAIL_REGEX } = require('./validacio');

function esStringNoBuit(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Valida la llista d'acompanyants d'una compra: nom + email (mateix format
 * que el del comprador principal, EMAIL_REGEX compartit via
 * utils/validacio.js) + telèfon opcional (igual que el del comprador —
 * vegeu stripeController.js:validarBody, no és obligatori tampoc allà).
 *
 * Ha d'haver-n'hi exactament `cantidad - 1`: el comprador principal ja
 * compta com a 1 plaça. Si `cantidad` és 1, stripeController.js no ha de
 * cridar aquesta funció en absolut (ni exigir ni acceptar acompanyants).
 */
function validarAcompanyants(acompanyants, cantidad) {
  const esperats = cantidad - 1;

  if (!Array.isArray(acompanyants)) {
    return ['acompanyants ha de ser una llista'];
  }
  if (acompanyants.length !== esperats) {
    return [`calen exactament ${esperats} acompanyant${esperats === 1 ? '' : 's'} (n'hi ha ${acompanyants.length})`];
  }

  const errors = [];
  acompanyants.forEach((ac, i) => {
    if (!ac || typeof ac !== 'object') {
      errors.push(`acompanyant ${i + 1}: dades invàlides`);
      return;
    }
    if (!esStringNoBuit(ac.nombre)) {
      errors.push(`acompanyant ${i + 1}: falta el nom`);
    }
    if (!EMAIL_REGEX.test(ac.email || '')) {
      errors.push(`acompanyant ${i + 1}: email invàlid`);
    }
  });
  return errors;
}

module.exports = { validarAcompanyants };
