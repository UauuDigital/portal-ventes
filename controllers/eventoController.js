const Evento = require('../models/Evento');
const Compra = require('../models/Compra');

/**
 * GET /api/evento/actual[?id=]
 * Retorna l'esdeveniment obert per a compra, amb l'aforament disponible calculat
 * a l'instant. Sense "id", agafa el més urgent (comportament de sempre, vàlid
 * quan només hi ha un esdeveniment actiu). Amb "id", retorna el detall d'aquell
 * esdeveniment concret (usat pel selector quan n'hi ha diversos alhora).
 * Si no està disponible (o s'ha exhaurit / superat la data límit), informa
 * del motiu perquè la landing pugui mostrar "compra tancada".
 */
async function getEventoActual(req, res) {
  const eventoId = req.query.id ? parseInt(req.query.id, 10) : null;
  const evento = eventoId ? await Evento.getById(eventoId) : await Evento.getActivo();

  if (!evento) {
    return res.json({ disponible: false, motiu: 'no_hi_ha_event_actiu' });
  }

  const ocupades = await Compra.cantidadOcupada(evento.id);
  const disponibles = evento.aforo_total - ocupades;
  const dataLimitSuperada = new Date() > new Date(evento.fecha_limite_compra);

  if (evento.estado !== 'abierto' || dataLimitSuperada || disponibles <= 0) {
    return res.json({
      disponible: false,
      motiu: dataLimitSuperada || evento.estado !== 'abierto' ? 'data_limit_superada' : 'aforament_exhaurit',
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
      aforo_total: evento.aforo_total,
    },
  });
}

/**
 * GET /api/evento/actius
 * Retorna la llista de tots els esdeveniments actius alhora (oberts i amb
 * termini de compra vigent). La landing l'usa per decidir si mostrar
 * directament el formulari de compra (0 o 1 actiu) o un selector en
 * quadrícula (2 o més).
 */
async function getEventosActius(req, res) {
  const eventos = await Evento.listActivos();
  const ambAforo = await Promise.all(
    eventos.map(async (ev) => {
      const ocupades = await Compra.cantidadOcupada(ev.id);
      return {
        id: ev.id,
        nombre: ev.nombre,
        fecha: ev.fecha,
        descripcion: ev.descripcion,
        aforo_total: ev.aforo_total,
        aforo_disponible: ev.aforo_total - ocupades,
      };
    })
  );
  res.json(ambAforo);
}

module.exports = { getEventoActual, getEventosActius };
