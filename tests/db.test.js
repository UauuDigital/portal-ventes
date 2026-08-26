const test = require('node:test');
const assert = require('node:assert/strict');

// Requerir un model (que al seu torn fa require('../config/db')) no ha de
// disparar cap connexió real: config/db.js ara només crea el pool en
// carregar-se, no aplica l'esquema ni executa cap query fins que algú ho
// demana explícitament (vegeu config/db.js). Es comprova ABANS de cridar
// aplicarSchema() enlloc.
const Compra = require('../models/Compra');
const db = require('../config/db');

test('requerir un model no dispara cap connexió (només es crea el pool)', () => {
  assert.equal(typeof Compra.create, 'function');
  assert.equal(db.pool.totalCount, 0);
});

test('aplicarSchema() aplica config/schema.sql i crea les taules esperades', async () => {
  await db.aplicarSchema();

  const { rows } = await db.pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  const taules = rows.map((r) => r.table_name);

  ['eventos', 'compras', 'evento_invitados', 'historial'].forEach((taula) => {
    assert.ok(taules.includes(taula), `falta la taula "${taula}"`);
  });
});

test.after(async () => {
  await db.pool.end();
});
