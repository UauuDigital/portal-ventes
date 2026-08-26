// Migra els invitats "únics" antics (eventos.nombre_invitado/cargo_invitado)
// a la taula nova evento_invitados, que permet més d'un invitat per
// esdeveniment. Idempotent: si un esdeveniment ja té files a
// evento_invitados (d'una execució prèvia d'aquest script, o perquè ja s'ha
// editat amb el sistema nou), es salta sense tocar-hi res.
//
// Ús: node scripts/migrar-invitados.js
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const eventos = await db
    .prepare(
      `SELECT id, nombre, nombre_invitado, cargo_invitado
       FROM eventos
       WHERE nombre_invitado IS NOT NULL AND trim(nombre_invitado) <> ''`
    )
    .all();

  let migrats = 0;
  let saltats = 0;

  for (const ev of eventos) {
    const jaTeInvitados = await db
      .prepare('SELECT id FROM evento_invitados WHERE evento_id = ? LIMIT 1')
      .get(ev.id);

    if (jaTeInvitados) {
      saltats++;
      console.log(`- Esdeveniment ${ev.id} ("${ev.nombre}"): ja té invitats a evento_invitados, es salta.`);
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
    console.log(`- Esdeveniment ${ev.id} ("${ev.nombre}"): migrat ("${ev.nombre_invitado.trim()}").`);
  }

  console.log('');
  console.log(`Resum: ${migrats} esdeveniment(s) migrat(s), ${saltats} ja tenien invitats i s'han saltat.`);
  process.exit(0);
})().catch((err) => {
  console.error('Error migrant invitats:', err);
  process.exit(1);
});
