const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'espai-economic.sqlite');

// Assegura que la carpeta de destí existeix (ex: data/)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
raw.exec(schema);

/**
 * Embolcall petit sobre node:sqlite (mòdul SQLite integrat a Node, sense
 * dependències natives — cap Python ni compilador C++ necessaris).
 * Permet que models/ segueixi fent servir paràmetres amb nom estil "@nom"
 * als INSERT/UPDATE (com abans amb better-sqlite3), convertint-los aquí a
 * la sintaxi ":nom" que espera node:sqlite.
 */
function toNamedParams(sql, data) {
  const params = {};
  for (const [key, value] of Object.entries(data)) {
    params[':' + key] = value;
  }
  return { sql: sql.replace(/@(\w+)/g, ':$1'), params };
}

function isPlainObjectParam(value, restLength) {
  return restLength === 0 && typeof value === 'object' && value !== null;
}

const db = {
  exec: (sql) => raw.exec(sql),
  prepare(sql) {
    return {
      get(...args) {
        const [first, ...rest] = args;
        if (isPlainObjectParam(first, rest.length)) {
          const { sql: convertedSql, params } = toNamedParams(sql, first);
          return raw.prepare(convertedSql).get(params);
        }
        return raw.prepare(sql).get(...args);
      },
      all(...args) {
        const [first, ...rest] = args;
        if (isPlainObjectParam(first, rest.length)) {
          const { sql: convertedSql, params } = toNamedParams(sql, first);
          return raw.prepare(convertedSql).all(params);
        }
        return raw.prepare(sql).all(...args);
      },
      run(...args) {
        const [first, ...rest] = args;
        if (isPlainObjectParam(first, rest.length)) {
          const { sql: convertedSql, params } = toNamedParams(sql, first);
          return raw.prepare(convertedSql).run(params);
        }
        return raw.prepare(sql).run(...args);
      },
    };
  },
};

module.exports = db;
