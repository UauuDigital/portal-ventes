const Compra = require('../models/Compra');
const Evento = require('../models/Evento');
const { validarRespuestas } = require('../utils/camposFormulario');

function eventoJaPassat(evento) {
  return new Date() > new Date(evento.fecha);
}

/**
 * GET /api/mis-datos/:token
 * Accés sense login: el token és l'únic secret. Es retorna només el
 * mínim necessari per pintar el formulari d'edició (mai dades d'altres
 * compres ni de l'esdeveniment sencer).
 */
async function obtenerMisDatos(req, res) {
  const compra = await Compra.findByEditToken(req.params.token);
  if (!compra) return res.status(404).json({ error: 'enllac_no_valid' });

  const evento = await Evento.getById(compra.evento_id);
  if (!evento) return res.status(404).json({ error: 'enllac_no_valid' });

  res.json({
    evento: { nombre: evento.nombre, fecha: evento.fecha },
    editable: !eventoJaPassat(evento),
    campos_formulario: Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [],
    respuestas_campos: compra.respuestas_campos || {},
  });
}

/**
 * PUT /api/mis-datos/:token
 * Revalida sempre contra la definició vigent de l'esdeveniment (pot haver
 * canviat des de la compra).
 */
async function actualizarMisDatos(req, res) {
  const compra = await Compra.findByEditToken(req.params.token);
  if (!compra) return res.status(404).json({ error: 'enllac_no_valid' });

  const evento = await Evento.getById(compra.evento_id);
  if (!evento) return res.status(404).json({ error: 'enllac_no_valid' });

  if (eventoJaPassat(evento)) {
    return res.status(403).json({ error: 'esdeveniment_ja_passat' });
  }

  const campos = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];
  const { errors, respuestasNormalizadas } = validarRespuestas(campos, req.body.respuestas_campos);
  if (errors.length) {
    return res.status(400).json({ error: 'dades_invalides', detalls: errors });
  }

  const respuestasFusionadas = { ...compra.respuestas_campos, ...respuestasNormalizadas };
  const actualitzada = await Compra.updateRespuestas(compra.id, respuestasFusionadas);
  res.json({ respuestas_campos: actualitzada.respuestas_campos });
}

module.exports = { obtenerMisDatos, actualizarMisDatos };
