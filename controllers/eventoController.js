const Evento = require('../models/Evento');
const Compra = require('../models/Compra');

/**
 * GET /api/evento/actual
 * Retorna l'esdeveniment obert per a compra, amb l'aforament disponible calculat
 * a l'instant. Si no n'hi ha (o s'ha exhaurit / superat la data límit), informa
 * del motiu perquè la landing pugui mostrar "compra tancada".
 */
async function getEventoActual(req, res) {
  const evento = await Evento.getActivo();
  if (!evento) {
    return res.json({ disponible: false, motiu: 'no_hi_ha_event_actiu' });
  }

  const ocupades = await Compra.cantidadOcupada(evento.id);
  const disponibles = evento.aforo_total - ocupades;
  const dataLimitSuperada = new Date() > new Date(evento.fecha_limite_compra);

  if (dataLimitSuperada || disponibles <= 0) {
    return res.json({
      disponible: false,
      motiu: dataLimitSuperada ? 'data_limit_superada' : 'aforament_exhaurit',
      evento: {
        nombre: evento.nombre,
        fecha: evento.fecha,
        descripcion: evento.descripcion,
      },
    });
  }

  return res.json({
    disponible: true,
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      fecha: evento.fecha,
      descripcion: evento.descripcion,
      precio: evento.precio,
      fecha_limite_compra: evento.fecha_limite_compra,
      aforo_disponible: disponibles,
    },
  });
}

module.exports = { getEventoActual };
