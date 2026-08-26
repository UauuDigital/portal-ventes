const db = require('../config/db');
const Historial = require('./Historial');

const CAMPS_AUDITABLES = [
  'nombre', 'nombre_es', 'nombre_en', 'fecha', 'descripcion', 'descripcion_es', 'descripcion_en',
  'precio', 'aforo_total', 'fecha_limite_compra', 'estado',
  'campos_formulario', 'email_asunto', 'email_html',
];
// nombre_invitado/cargo_invitado ja no hi són: obsoletes, substituïdes per
// evento_invitados (vegeu config/schema.sql). Els seus canvis es tracten a
// part a create()/update() perquè no són columnes d'eventos.

/**
 * Retorna els convidats/ponents d'un esdeveniment, en l'ordre en què s'han
 * de mostrar.
 */
async function getInvitados(eventoId) {
  return db
    .prepare('SELECT id, nombre, cargo, orden FROM evento_invitados WHERE evento_id = ? ORDER BY orden ASC, id ASC')
    .all(eventoId);
}

/**
 * Substitueix tota la llista de convidats d'un esdeveniment (esborra els
 * existents i insereix els nous, en l'ordre rebut). No hi ha CRUD granular
 * per convidat individual: l'admin sempre desa la llista sencera de cop.
 */
async function setInvitados(eventoId, invitados) {
  await db.prepare('DELETE FROM evento_invitados WHERE evento_id = ?').run(eventoId);
  let orden = 1;
  for (const inv of invitados) {
    await db
      .prepare(
        `INSERT INTO evento_invitados (evento_id, nombre, cargo, orden)
         VALUES (@evento_id, @nombre, @cargo, @orden)`
      )
      .run({ evento_id: eventoId, nombre: inv.nombre, cargo: inv.cargo || null, orden: orden++ });
  }
}

/** Compara dues llistes d'invitats només pel contingut (nom/càrrec), sense
 * els id/orden que genera la BD en cada reemplaçament — evita falsos
 * positius a l'historial quan es desa la mateixa llista dues vegades. */
function invitadosPerComparar(llista) {
  return (llista || []).map(({ nombre, cargo }) => ({ nombre, cargo: cargo || null }));
}

/** Afegeix `invitados` a un esdeveniment (o retorna null si no existeix). */
async function ambInvitados(evento) {
  if (!evento) return evento;
  return { ...evento, invitados: await getInvitados(evento.id) };
}

/**
 * Tanca automàticament els esdeveniments oberts la data límit de compra dels
 * quals ja ha passat. Es crida abans de qualsevol lectura per mantenir
 * l'estat sempre al dia sense necessitat d'una tasca programada.
 */
async function tancarExpirats() {
  const now = new Date().toISOString();
  const afectats = await db
    .prepare(`SELECT id, nombre FROM eventos WHERE estado = 'abierto' AND fecha_limite_compra <= ?`)
    .all(now);
  if (afectats.length === 0) return;

  await db
    .prepare(
      `UPDATE eventos SET estado = 'cerrado'
       WHERE estado = 'abierto' AND fecha_limite_compra <= ?`
    )
    .run(now);

  for (const ev of afectats) {
    await Historial.registrar({
      tipus_entitat: 'evento',
      entitat_id: ev.id,
      evento_id: ev.id,
      accio: 'modificacio',
      origen: 'automatic',
      usuari: 'sistema',
      descripcio: `Esdeveniment "${ev.nombre}" tancat automàticament (termini de compra superat)`,
      dades_abans: { estado: 'abierto' },
      dades_despres: { estado: 'cerrado' },
    });
  }
}

/**
 * Retorna l'esdeveniment actiu: el que està "abierto" i encara no ha superat
 * la seva data límit de compra. Si n'hi hagués més d'un, es queda amb el que
 * té el termini de compra més proper (més urgent per reservar).
 */
async function getActivo() {
  await tancarExpirats();
  const now = new Date().toISOString();
  const evento = await db
    .prepare(
      `SELECT * FROM eventos
       WHERE estado = 'abierto' AND fecha_limite_compra > ?
       ORDER BY fecha_limite_compra ASC
       LIMIT 1`
    )
    .get(now);
  return ambInvitados(evento);
}

/**
 * Retorna tots els esdeveniments actius (oberts i amb termini de compra
 * encara vigent), ordenats pel termini més proper primer. A diferència de
 * getActivo(), no es queda només amb un: serveix per saber si cal mostrar
 * un selector quan n'hi ha més d'un obert alhora.
 */
async function listActivos() {
  await tancarExpirats();
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM eventos
       WHERE estado = 'abierto' AND fecha_limite_compra > ?
       ORDER BY fecha_limite_compra ASC`
    )
    .all(now);
}

async function getById(id) {
  await tancarExpirats();
  const evento = await db.prepare('SELECT * FROM eventos WHERE id = ?').get(id);
  return ambInvitados(evento);
}

async function create(data, meta = {}) {
  const stmt = db.prepare(
    `INSERT INTO eventos (nombre, nombre_es, nombre_en, fecha, descripcion, descripcion_es, descripcion_en, precio, aforo_total, fecha_limite_compra, estado, campos_formulario, email_asunto, email_html)
     VALUES (@nombre, @nombre_es, @nombre_en, @fecha, @descripcion, @descripcion_es, @descripcion_en, @precio, @aforo_total, @fecha_limite_compra, @estado, @campos_formulario, @email_asunto, @email_html)
     RETURNING id`
  );
  const info = await stmt.run({
    estado: 'abierto',
    descripcion: null,
    descripcion_es: null,
    descripcion_en: null,
    nombre_es: null,
    nombre_en: null,
    campos_formulario: JSON.stringify([]),
    email_asunto: null,
    email_html: null,
    ...data,
    campos_formulario: JSON.stringify(data.campos_formulario || []),
  });
  await setInvitados(info.lastInsertRowid, Array.isArray(data.invitados) ? data.invitados : []);
  const evento = await getById(info.lastInsertRowid);
  await Historial.registrar({
    tipus_entitat: 'evento',
    entitat_id: evento.id,
    evento_id: evento.id,
    accio: 'creacio',
    origen: meta.origen || 'manual',
    usuari: meta.usuari || null,
    descripcio: `Esdeveniment "${evento.nombre}" creat`,
    dades_despres: evento,
  });
  return evento;
}

async function update(id, data, meta = {}) {
  const actual = await getById(id);
  if (!actual) return null;
  const {
    nombre, nombre_es, nombre_en, fecha,
    descripcion, descripcion_es, descripcion_en,
    precio, aforo_total, fecha_limite_compra, estado,
    campos_formulario, email_asunto, email_html,
  } = { ...actual, ...data };
  await db
    .prepare(
      `UPDATE eventos SET nombre=@nombre, nombre_es=@nombre_es, nombre_en=@nombre_en, fecha=@fecha,
         descripcion=@descripcion, descripcion_es=@descripcion_es, descripcion_en=@descripcion_en,
         precio=@precio, aforo_total=@aforo_total,
         fecha_limite_compra=@fecha_limite_compra, estado=@estado,
         campos_formulario=@campos_formulario,
         email_asunto=@email_asunto, email_html=@email_html
       WHERE id=@id`
    )
    .run({
      nombre, nombre_es, nombre_en, fecha,
      descripcion, descripcion_es, descripcion_en,
      precio, aforo_total, fecha_limite_compra, estado, id,
      campos_formulario: JSON.stringify(campos_formulario || []),
      email_asunto: email_asunto || null,
      email_html: email_html || null,
    });

  // Els invitats no són una columna d'eventos: es tracten a part i només es
  // toquen si venen explícitament (igual que campos_formulario, permet
  // editar la resta de l'esdeveniment sense reenviar sempre la llista).
  let invitadosAbans;
  let invitadosDespres;
  let invitadosCanviats = false;
  if (data.invitados !== undefined) {
    invitadosAbans = invitadosPerComparar(actual.invitados);
    await setInvitados(id, data.invitados);
    invitadosDespres = invitadosPerComparar(data.invitados);
    invitadosCanviats = JSON.stringify(invitadosAbans) !== JSON.stringify(invitadosDespres);
  }

  const nou = await getById(id);
  const { abans, despres, hiHaCanvis } = Historial.diffCamps(actual, nou, CAMPS_AUDITABLES);
  if (invitadosCanviats) {
    abans.invitados = invitadosAbans;
    despres.invitados = invitadosDespres;
  }
  if (hiHaCanvis || invitadosCanviats) {
    await Historial.registrar({
      tipus_entitat: 'evento',
      entitat_id: id,
      evento_id: id,
      accio: 'modificacio',
      origen: meta.origen || 'manual',
      usuari: meta.usuari || (meta.origen === 'automatic' ? 'sistema' : null),
      descripcio: `Esdeveniment "${nou.nombre}" modificat`,
      dades_abans: abans,
      dades_despres: despres,
    });
  }
  return nou;
}

async function listAll() {
  await tancarExpirats();
  return db.prepare('SELECT * FROM eventos ORDER BY fecha DESC').all();
}

async function remove(id, meta = {}) {
  const evento = await getById(id);
  await db.prepare('DELETE FROM eventos WHERE id = ?').run(id);
  if (evento) {
    await Historial.registrar({
      tipus_entitat: 'evento',
      entitat_id: id,
      evento_id: id,
      accio: 'eliminacio',
      origen: meta.origen || 'manual',
      usuari: meta.usuari || null,
      descripcio: `Esdeveniment "${evento.nombre}" eliminat`,
      dades_abans: evento,
    });
  }
}

module.exports = {
  getActivo, listActivos, getById, create, update, listAll, remove,
  getInvitados, setInvitados,
};
