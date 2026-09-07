const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL a l\'entorn: cal la connection string de Supabase/Postgres.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

/**
 * Aplica config/schema.sql contra la BD connectada. Abans això passava sol
 * en carregar aquest mòdul (efecte secundari del require): calia fer
 * require('../config/db') — directament o via qualsevol model/controller —
 * per tocar de veritat la BD, cosa que feia impossible fer require d'un
 * model en un test sense connectar-se a una BD real (vegeu hallazgo ALT #9
 * de l'auditoria inicial).
 *
 * Ara és responsabilitat explícita de qui arrenca l'aplicació (server.js,
 * abans d'app.listen) o de qui l'escriu (scripts/migrar-invitados.js,
 * scripts/seed.js, tests que necessitin BD de debò). És idempotent
 * (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS): es pot cridar
 * tantes vegades com calgui sense trencar res.
 */
async function aplicarSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
  } catch (err) {
    console.error('Error aplicant l\'esquema a la base de dades:', err);
    throw err;
  }
}

/**
 * Converteix una sentència amb paràmetres amb nom estil "@nom" (com abans amb
 * node:sqlite) a la sintaxi posicional "$1, $2..." que espera pg, agafant els
 * valors de l'objecte de dades passat.
 */
function toNamedParams(sql, data) {
  const values = [];
  const text = sql.replace(/@(\w+)/g, (_, key) => {
    values.push(data[key]);
    return `$${values.length}`;
  });
  return { text, values };
}

/** Converteix placeholders posicionals "?" a "$1, $2..." per als args donats. */
function toPositionalParams(sql, args) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: args };
}

function build(sql, args) {
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    return toNamedParams(sql, args[0]);
  }
  return toPositionalParams(sql, args);
}

async function execute(sql, args) {
  const { text, values } = build(sql, args);
  return pool.query(text, values);
}

const db = {
  pool,
  aplicarSchema,
  prepare(sql) {
    return {
      async get(...args) {
        const res = await execute(sql, args);
        return res.rows[0];
      },
      async all(...args) {
        const res = await execute(sql, args);
        return res.rows;
      },
      async run(...args) {
        const res = await execute(sql, args);
        return {
          changes: res.rowCount,
          lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined,
        };
      },
    };
  },
};

module.exports = db;
