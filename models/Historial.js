const db = require('../config/db');

async function registrar({
  tipus_entitat, entitat_id, evento_id, accio, origen, usuari, descripcio, dades_abans, dades_despres,
}) {
  await db
    .prepare(
      `INSERT INTO historial (tipus_entitat, entitat_id, evento_id, accio, origen, usuari, descripcio, dades_abans, dades_despres)
       VALUES (@tipus_entitat, @entitat_id, @evento_id, @accio, @origen, @usuari, @descripcio, @dades_abans, @dades_despres)`
    )
    .run({
      tipus_entitat,
      entitat_id: entitat_id ?? null,
      evento_id: evento_id ?? null,
      accio,
      origen: origen || 'automatic',
      usuari: usuari || null,
      descripcio,
      dades_abans: dades_abans ? JSON.stringify(dades_abans) : null,
      dades_despres: dades_despres ? JSON.stringify(dades_despres) : null,
    });
}

async function llistar({ eventoId, limit = 30, offset = 0 } = {}) {
  const params = [];
  let where = '';
  if (eventoId) {
    where = 'WHERE h.evento_id = ?';
    params.push(eventoId);
  }
  params.push(limit, offset);
  return db
    .prepare(
      `SELECT h.*, e.nombre AS evento_nombre
       FROM historial h
       LEFT JOIN eventos e ON e.id = h.evento_id
       ${where}
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params);
}

/**
 * Compara dos objectes camp a camp i retorna només els que han canviat, per
 * guardar a l'historial els valors abans/després d'una modificació sense
 * arrossegar-hi tots els camps que no han variat.
 */
function diffCamps(abans, despres, camps) {
  const abansOut = {};
  const despresOut = {};
  camps.forEach((camp) => {
    const a = abans ? abans[camp] : undefined;
    const d = despres ? despres[camp] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(d)) {
      abansOut[camp] = a;
      despresOut[camp] = d;
    }
  });
  return { abans: abansOut, despres: despresOut, hiHaCanvis: Object.keys(despresOut).length > 0 };
}

module.exports = { registrar, llistar, diffCamps };
