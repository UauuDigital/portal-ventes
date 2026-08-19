const TIPOS_VALIDOS = ['texto', 'numero', 'seleccion'];

function esStringNoBuit(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Valida la definició de camps que envia l'admin en crear/editar un
 * esdeveniment. No toca respostes existents: només l'estructura.
 */
function validarDefinicionCampos(campos) {
  const errors = [];
  if (!Array.isArray(campos)) {
    return ['campos_formulario ha de ser una llista'];
  }

  const idsVists = new Set();

  campos.forEach((campo, i) => {
    const ref = `camp ${i + 1}`;
    if (!campo || typeof campo !== 'object') {
      errors.push(`${ref}: definició invàlida`);
      return;
    }
    if (!esStringNoBuit(campo.id)) {
      errors.push(`${ref}: falta un identificador`);
    } else if (!/^[A-Za-z0-9_-]{1,64}$/.test(campo.id)) {
      errors.push(`${ref}: identificador amb format invàlid`);
    } else if (idsVists.has(campo.id)) {
      errors.push(`${ref}: identificador duplicat "${campo.id}"`);
    } else {
      idsVists.add(campo.id);
    }
    if (!esStringNoBuit(campo.etiqueta)) {
      errors.push(`${ref}: falta l'etiqueta`);
    }
    if (!TIPOS_VALIDOS.includes(campo.tipo)) {
      errors.push(`${ref}: tipus invàlid`);
      return;
    }

    if (campo.tipo === 'numero') {
      const { min, max } = campo;
      if (min !== undefined && min !== null && typeof min !== 'number') {
        errors.push(`${ref}: el mínim ha de ser un número`);
      }
      if (max !== undefined && max !== null && typeof max !== 'number') {
        errors.push(`${ref}: el màxim ha de ser un número`);
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors.push(`${ref}: el mínim no pot ser més gran que el màxim`);
      }
    }

    if (campo.tipo === 'seleccion') {
      if (!Array.isArray(campo.opciones) || campo.opciones.filter(esStringNoBuit).length === 0) {
        errors.push(`${ref}: cal almenys una opció`);
      }
    }
  });

  return errors;
}

/**
 * Valida i normalitza les respostes que envia el comprador (en crear la
 * compra o en editar-les després) contra la definició vigent de
 * l'esdeveniment. Els camps que ja no existeixen a la definició s'ignoren
 * (no generen error): permet que l'admin elimini camps sense trencar
 * compres que ja els havien respost.
 */
function validarRespuestas(campos, respuestas) {
  const errors = [];
  const respuestasNormalizadas = {};
  const entrada = respuestas && typeof respuestas === 'object' ? respuestas : {};

  (Array.isArray(campos) ? campos : []).forEach((campo) => {
    const valor = entrada[campo.id];
    const buit = valor === undefined || valor === null || valor === '' ||
      (Array.isArray(valor) && valor.length === 0);

    if (buit) {
      if (campo.requerido) errors.push(`"${campo.etiqueta}" és obligatori`);
      return;
    }

    if (campo.tipo === 'texto') {
      respuestasNormalizadas[campo.id] = String(valor).trim();
      return;
    }

    if (campo.tipo === 'numero') {
      const num = typeof valor === 'number' ? valor : parseFloat(valor);
      if (Number.isNaN(num)) {
        errors.push(`"${campo.etiqueta}" ha de ser un número`);
        return;
      }
      if (typeof campo.min === 'number' && num < campo.min) {
        errors.push(`"${campo.etiqueta}" ha de ser com a mínim ${campo.min}`);
        return;
      }
      if (typeof campo.max === 'number' && num > campo.max) {
        errors.push(`"${campo.etiqueta}" ha de ser com a màxim ${campo.max}`);
        return;
      }
      respuestasNormalizadas[campo.id] = num;
      return;
    }

    if (campo.tipo === 'seleccion') {
      const opcionsValides = Array.isArray(campo.opciones) ? campo.opciones : [];
      const seleccio = campo.multiple
        ? (Array.isArray(valor) ? valor : [valor])
        : [Array.isArray(valor) ? valor[0] : valor];

      const totesValides = seleccio.every((v) => opcionsValides.includes(v));
      if (!totesValides) {
        errors.push(`"${campo.etiqueta}" té una opció no vàlida`);
        return;
      }
      respuestasNormalizadas[campo.id] = campo.multiple ? seleccio : seleccio[0];
    }
  });

  return { errors, respuestasNormalizadas };
}

module.exports = { validarDefinicionCampos, validarRespuestas };
