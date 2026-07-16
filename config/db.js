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

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// S'espera abans de qualsevol consulta perquè les taules existeixin
// (equivalent al raw.exec(schema) síncron que abans feia node:sqlite).
const ready = pool.query(schema).catch((err) => {
  console.error('Error aplicant l\'esquema a la base de dades:', err);
  throw err;
});

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
  await ready;
  const { text, values } = build(sql, args);
  return pool.query(text, values);
}

const db = {
  ready,
  pool,
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
