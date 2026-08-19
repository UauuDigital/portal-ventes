const db = require('../config/db');

/**
 * Tanca automàticament els esdeveniments oberts la data límit de compra dels
 * quals ja ha passat. Es crida abans de qualsevol lectura per mantenir
 * l'estat sempre al dia sense necessitat d'una tasca programada.
 */
async function tancarExpirats() {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE eventos SET estado = 'cerrado'
       WHERE estado = 'abierto' AND fecha_limite_compra <= ?`
    )
    .run(now);
}

/**
 * Retorna l'esdeveniment actiu: el que està "abierto" i encara no ha superat
 * la seva data límit de compra. Si n'hi hagués més d'un, es queda amb el que
 * té el termini de compra més proper (més urgent per reservar).
 */
async function getActivo() {
  await tancarExpirats();
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM eventos
       WHERE estado = 'abierto' AND fecha_limite_compra > ?
       ORDER BY fecha_limite_compra ASC
       LIMIT 1`
    )
    .get(now);
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
  return db.prepare('SELECT * FROM eventos WHERE id = ?').get(id);
}

async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO eventos (nombre, nombre_es, nombre_en, fecha, descripcion, descripcion_es, descripcion_en, precio, aforo_total, fecha_limite_compra, estado, nombre_invitado, cargo_invitado, campos_formulario, email_asunto, email_html)
     VALUES (@nombre, @nombre_es, @nombre_en, @fecha, @descripcion, @descripcion_es, @descripcion_en, @precio, @aforo_total, @fecha_limite_compra, @estado, @nombre_invitado, @cargo_invitado, @campos_formulario, @email_asunto, @email_html)
     RETURNING id`
  );
  const info = await stmt.run({
    estado: 'abierto',
    descripcion: null,
    descripcion_es: null,
    descripcion_en: null,
    nombre_es: null,
    nombre_en: null,
    nombre_invitado: null,
    cargo_invitado: null,
    campos_formulario: JSON.stringify([]),
    email_asunto: null,
    email_html: null,
    ...data,
    campos_formulario: JSON.stringify(data.campos_formulario || []),
  });
  return getById(info.lastInsertRowid);
}

async function update(id, data) {
  const actual = await getById(id);
  if (!actual) return null;
  const {
    nombre, nombre_es, nombre_en, fecha,
    descripcion, descripcion_es, descripcion_en,
    precio, aforo_total, fecha_limite_compra, estado,
    nombre_invitado, cargo_invitado, campos_formulario,
    email_asunto, email_html,
  } = { ...actual, ...data };
  await db
    .prepare(
      `UPDATE eventos SET nombre=@nombre, nombre_es=@nombre_es, nombre_en=@nombre_en, fecha=@fecha,
         descripcion=@descripcion, descripcion_es=@descripcion_es, descripcion_en=@descripcion_en,
         precio=@precio, aforo_total=@aforo_total,
         fecha_limite_compra=@fecha_limite_compra, estado=@estado,
         nombre_invitado=@nombre_invitado, cargo_invitado=@cargo_invitado,
         campos_formulario=@campos_formulario,
         email_asunto=@email_asunto, email_html=@email_html
       WHERE id=@id`
    )
    .run({
      nombre, nombre_es, nombre_en, fecha,
      descripcion, descripcion_es, descripcion_en,
      precio, aforo_total, fecha_limite_compra, estado, id,
      nombre_invitado, cargo_invitado,
      campos_formulario: JSON.stringify(campos_formulario || []),
      email_asunto: email_asunto || null,
      email_html: email_html || null,
    });
  return getById(id);
}

async function listAll() {
  await tancarExpirats();
  return db.prepare('SELECT * FROM eventos ORDER BY fecha DESC').all();
}

async function remove(id) {
  await db.prepare('DELETE FROM eventos WHERE id = ?').run(id);
}

module.exports = { getActivo, listActivos, getById, create, update, listAll, remove };
