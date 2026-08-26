const Evento = require('../models/Evento');
const Compra = require('../models/Compra');

const IDIOMES_SUPORTATS = ['ca', 'es', 'en'];

/** Tria la variant en l'idioma demanat (?lang=es|en) d'un camp traduït, amb
 * el català com a origen i valor de reserva si encara no hi ha traducció. */
function textSegonsIdioma(base, baseEs, baseEn, lang) {
  if (lang === 'es' && baseEs) return baseEs;
  if (lang === 'en' && baseEn) return baseEn;
  return base;
}

function nomSegonsIdioma(evento, lang) {
  return textSegonsIdioma(evento.nombre, evento.nombre_es, evento.nombre_en, lang);
}

function descripcioSegonsIdioma(evento, lang) {
  return textSegonsIdioma(evento.descripcion, evento.descripcion_es, evento.descripcion_en, lang);
}

function idiomaSollicitat(req) {
  const lang = String(req.query.lang || '').toLowerCase();
  return IDIOMES_SUPORTATS.includes(lang) ? lang : 'ca';
}

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
  const lang = idiomaSollicitat(req);

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
        nombre: nomSegonsIdioma(evento, lang),
        fecha: evento.fecha,
        descripcion: descripcioSegonsIdioma(evento, lang),
      },
    });
  }

  return res.json({
    disponible: true,
    evento: {
      id: evento.id,
      nombre: nomSegonsIdioma(evento, lang),
      fecha: evento.fecha,
      descripcion: descripcioSegonsIdioma(evento, lang),
      precio: evento.precio,
      fecha_limite_compra: evento.fecha_limite_compra,
      aforo_disponible: disponibles,
      aforo_total: evento.aforo_total,
      campos_formulario: Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [],
      invitados: (Array.isArray(evento.invitados) ? evento.invitados : [])
        .map(({ nombre, cargo }) => ({ nombre, cargo })),
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
  const lang = idiomaSollicitat(req);
  const ambAforo = await Promise.all(
    eventos.map(async (ev) => {
      const ocupades = await Compra.cantidadOcupada(ev.id);
      return {
        id: ev.id,
        nombre: nomSegonsIdioma(ev, lang),
        fecha: ev.fecha,
        descripcion: descripcioSegonsIdioma(ev, lang),
        aforo_total: ev.aforo_total,
        aforo_disponible: ev.aforo_total - ocupades,
      };
    })
  );
  res.json(ambAforo);
}

module.exports = { getEventoActual, getEventosActius };
