// Migra els invitats "únics" antics (eventos.nombre_invitado/cargo_invitado)
// a la taula nova evento_invitados, que permet més d'un invitat per
// esdeveniment. Idempotent: si un esdeveniment ja té files a
// evento_invitados (d'una execució prèvia d'aquest script, o perquè ja s'ha
// editat amb el sistema nou), es salta sense tocar-hi res.
//
// Ús per CLI: node scripts/migrar-invitados.js (o npm run migrar-invitados)
// També s'exporta migrarInvitados() perquè es pugui cridar des d'un altre
// procés que ja tingui l'entorn carregat, si mai cal reexecutar la migració
// des d'un altre lloc.
require('dotenv').config();
const db = require('../config/db');

async function migrarInvitados() {
  // require('../config/db') ja no aplica l'esquema sol (vegeu el comentari
  // d'aplicarSchema() a config/db.js): cal fer-ho explícitament aquí perquè
  // el script segueixi funcionant igual encara que es cridi contra una BD
  // on el servidor no s'hagi arrencat mai. Idempotent, sense cost real si
  // ja estava aplicat.
  await db.aplicarSchema();

  const eventos = await db
    .prepare(
      `SELECT id, nombre, nombre_invitado, cargo_invitado
       FROM eventos
       WHERE nombre_invitado IS NOT NULL AND trim(nombre_invitado) <> ''`
    )
    .all();

  let migrats = 0;
  let saltats = 0;
  const detalls = [];

  for (const ev of eventos) {
    const jaTeInvitados = await db
      .prepare('SELECT id FROM evento_invitados WHERE evento_id = ? LIMIT 1')
      .get(ev.id);

    if (jaTeInvitados) {
      saltats++;
      detalls.push(`Esdeveniment ${ev.id} ("${ev.nombre}"): ja té invitats a evento_invitados, es salta.`);
      continue;
    }

    await db
      .prepare(
        `INSERT INTO evento_invitados (evento_id, nombre, cargo, orden)
         VALUES (@evento_id, @nombre, @cargo, 1)`
      )
      .run({
        evento_id: ev.id,
        nombre: ev.nombre_invitado.trim(),
        cargo: ev.cargo_invitado ? ev.cargo_invitado.trim() : null,
      });
    migrats++;
    detalls.push(`Esdeveniment ${ev.id} ("${ev.nombre}"): migrat ("${ev.nombre_invitado.trim()}").`);
  }

  return { migrats, saltats, detalls };
}

// Permet seguir executant-lo per CLI exactament igual que abans, sense
// afectar qui l'importi com a mòdul (p. ex. la ruta admin temporal).
if (require.main === module) {
  migrarInvitados()
    .then(({ migrats, saltats, detalls }) => {
      detalls.forEach((linia) => console.log(`- ${linia}`));
      console.log('');
      console.log(`Resum: ${migrats} esdeveniment(s) migrat(s), ${saltats} ja tenien invitats i s'han saltat.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error migrant invitats:', err);
      process.exit(1);
    });
}

module.exports = { migrarInvitados };
