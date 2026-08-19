# Formulari de compra personalitzat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permetre que l'admin defineixi camps personalitzats per esdeveniment (text/número/selecció, amb requerit/unitat/min/max/opcions), que el comprador els respongui en comprar, i que pugui editar les respostes després via un enllaç únic per email fins que l'esdeveniment tingui lloc.

**Architecture:** Els camps es defineixen com un array JSONB (`eventos.campos_formulario`) i les respostes com un objecte JSONB keyed per `id` de camp (`compras.respuestas_campos`), de manera que canvis de definició no trenquen compres antigues. L'accés d'edició posterior és per token opac (`compras.edit_token`), sense sistema de login pel comprador. Tota validació de valors contra la definició (requerit/min/max/opcions) viu en un únic mòdul compartit (`utils/camposFormulario.js`) perquè backend de compra i backend d'edició no divergeixin.

**Tech Stack:** Node.js + Express, PostgreSQL (`pg`, via `config/db.js`), HTML/CSS/JS vanilla sense build step.

**Spec:** `docs/superpowers/specs/2026-08-18-formulari-compra-personalitzat-design.md`

## Global Constraints

- Tots els missatges d'error mostrats a l'usuari han de ser en català, mai errors tècnics en cru (regla global del projecte).
- No s'introdueix cap framework de testing nou: el projecte no en té, i cada tasca es verifica manualment amb `node -e` / crides HTTP reals contra la BD de desenvolupament, seguint la secció "Testing" de l'spec.
- `kebab-case` per a fitxers nous.
- Cap canvi als camps existents de `compras`/`eventos`; només columnes noves.
- Els comentaris de codi, quan calguin, van en català i només expliquen el "per què", no el "què".

---

## File Structure

- `config/schema.sql` — noves columnes `eventos.campos_formulario`, `compras.respuestas_campos`, `compras.edit_token`.
- `utils/camposFormulario.js` (nou) — validació compartida: definició de camps (admin) i respostes (comprador).
- `models/Evento.js` — persistir `campos_formulario`.
- `models/Compra.js` — persistir `respuestas_campos`/`edit_token`, generar token, cercar per token, actualitzar respostes.
- `controllers/adminController.js` — validar/desar `campos_formulario` en crear/actualitzar esdeveniment; incloure columnes dinàmiques en `exportarComprasCsv`.
- `controllers/eventoController.js` — exposar `campos_formulario` a `/api/evento/actual`.
- `controllers/stripeController.js` — validar/desar `respuestas_campos` en crear la compra; email amb enllaç.
- `controllers/misDatosController.js` (nou) — `GET`/`PUT /api/mis-datos/:token`.
- `routes/publicRoutes.js` — noves rutes de `mis-datos`.
- `utils/mailer.js` — enllaç d'edició a l'email de confirmació.
- `public/admin/evento.html` + `public/js/admin.js` — secció CRUD de camps; columnes dinàmiques a la taula de compres.
- `public/index.html` + `public/js/checkout.js` — renderitzat dinàmic dels camps al formulari de compra.
- `public/mis-datos.html` + `public/js/mis-datos.js` (nous) — pàgina d'edició posterior.

---

### Task 1: Esquema de base de dades

**Files:**
- Modify: `config/schema.sql`

**Interfaces:**
- Produces: columnes `eventos.campos_formulario` (JSONB, default `[]`), `compras.respuestas_campos` (JSONB, default `{}`), `compras.edit_token` (TEXT, UNIQUE, nullable).

- [ ] **Step 1: Afegir les columnes noves**

Afegeix al final de `config/schema.sql`, abans de les línies `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`:

```sql
-- Constructor de formulari de compra personalitzat per esdeveniment (vegeu
-- docs/superpowers/specs/2026-08-18-formulari-compra-personalitzat-design.md).
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS campos_formulario JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE compras ADD COLUMN IF NOT EXISTS respuestas_campos JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS edit_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_edit_token ON compras(edit_token) WHERE edit_token IS NOT NULL;
```

- [ ] **Step 2: Verificar que l'esquema s'aplica sense error**

Run: `node -e "require('./config/db').ready.then(() => { console.log('OK'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); })"`
Expected: imprimeix `OK` i surt amb codi 0 (l'esquema s'aplica a l'arrencada de `config/db.js`).

- [ ] **Step 3: Commit**

```bash
git add config/schema.sql
git commit -m "Millora: columnes per al formulari de compra personalitzat"
```

---

### Task 2: Mòdul de validació compartit `utils/camposFormulario.js`

**Files:**
- Create: `utils/camposFormulario.js`

**Interfaces:**
- Produces:
  - `validarDefinicionCampos(campos)` → `string[]` (llista d'errors; buida si és vàlid). Valida l'array que envia l'admin.
  - `validarRespuestas(campos, respuestas)` → `{ errors: string[], respuestasNormalizadas: object }`. Valida les respostes del comprador contra la definició, i normalitza (retalla strings, converteix números).
  - Forma d'un camp de definició: `{ id: string, etiqueta: string, tipo: 'texto'|'numero'|'seleccion', requerido: boolean, unidad?: string, min?: number, max?: number, opciones?: string[], multiple?: boolean }`.

- [ ] **Step 1: Escriure el mòdul**

```javascript
const TIPOS_VALIDOS = ['texto', 'numero', 'seleccion'];

function esStringNoBuit(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Valida la definició de camps que envia l'admin en crear/editar un
 * esdeveniment. No toca respostes existents: només l'estructura.
 */
function validarDefinicionCampos(campos) {
  const errors = [];
  if (!Array.isArray(campos)) {
    return ['campos_formulario ha de ser una llista'];
  }

  const idsVists = new Set();

  campos.forEach((campo, i) => {
    const ref = `camp ${i + 1}`;
    if (!campo || typeof campo !== 'object') {
      errors.push(`${ref}: definició invàlida`);
      return;
    }
    if (!esStringNoBuit(campo.id)) {
      errors.push(`${ref}: falta un identificador`);
    } else if (idsVists.has(campo.id)) {
      errors.push(`${ref}: identificador duplicat "${campo.id}"`);
    } else {
      idsVists.add(campo.id);
    }
    if (!esStringNoBuit(campo.etiqueta)) {
      errors.push(`${ref}: falta l'etiqueta`);
    }
    if (!TIPOS_VALIDOS.includes(campo.tipo)) {
      errors.push(`${ref}: tipus invàlid`);
      return;
    }

    if (campo.tipo === 'numero') {
      const { min, max } = campo;
      if (min !== undefined && min !== null && typeof min !== 'number') {
        errors.push(`${ref}: el mínim ha de ser un número`);
      }
      if (max !== undefined && max !== null && typeof max !== 'number') {
        errors.push(`${ref}: el màxim ha de ser un número`);
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors.push(`${ref}: el mínim no pot ser més gran que el màxim`);
      }
    }

    if (campo.tipo === 'seleccion') {
      if (!Array.isArray(campo.opciones) || campo.opciones.filter(esStringNoBuit).length === 0) {
        errors.push(`${ref}: cal almenys una opció`);
      }
    }
  });

  return errors;
}

/**
 * Valida i normalitza les respostes que envia el comprador (en crear la
 * compra o en editar-les després) contra la definició vigent de
 * l'esdeveniment. Els camps que ja no existeixen a la definició s'ignoren
 * (no generen error): permet que l'admin elimini camps sense trencar
 * compres que ja els havien respost.
 */
function validarRespuestas(campos, respuestas) {
  const errors = [];
  const respuestasNormalizadas = {};
  const entrada = respuestas && typeof respuestas === 'object' ? respuestas : {};

  (Array.isArray(campos) ? campos : []).forEach((campo) => {
    const valor = entrada[campo.id];
    const buit = valor === undefined || valor === null || valor === '' ||
      (Array.isArray(valor) && valor.length === 0);

    if (buit) {
      if (campo.requerido) errors.push(`"${campo.etiqueta}" és obligatori`);
      return;
    }

    if (campo.tipo === 'texto') {
      respuestasNormalizadas[campo.id] = String(valor).trim();
      return;
    }

    if (campo.tipo === 'numero') {
      const num = typeof valor === 'number' ? valor : parseFloat(valor);
      if (Number.isNaN(num)) {
        errors.push(`"${campo.etiqueta}" ha de ser un número`);
        return;
      }
      if (typeof campo.min === 'number' && num < campo.min) {
        errors.push(`"${campo.etiqueta}" ha de ser com a mínim ${campo.min}`);
        return;
      }
      if (typeof campo.max === 'number' && num > campo.max) {
        errors.push(`"${campo.etiqueta}" ha de ser com a màxim ${campo.max}`);
        return;
      }
      respuestasNormalizadas[campo.id] = num;
      return;
    }

    if (campo.tipo === 'seleccion') {
      const opcionsValides = Array.isArray(campo.opciones) ? campo.opciones : [];
      const seleccio = campo.multiple
        ? (Array.isArray(valor) ? valor : [valor])
        : [Array.isArray(valor) ? valor[0] : valor];

      const totesValides = seleccio.every((v) => opcionsValides.includes(v));
      if (!totesValides) {
        errors.push(`"${campo.etiqueta}" té una opció no vàlida`);
        return;
      }
      respuestasNormalizadas[campo.id] = campo.multiple ? seleccio : seleccio[0];
    }
  });

  return { errors, respuestasNormalizadas };
}

module.exports = { validarDefinicionCampos, validarRespuestas };
```

- [ ] **Step 2: Verificar manualment amb casos reals**

Run:
```bash
node -e "
const { validarDefinicionCampos, validarRespuestas } = require('./utils/camposFormulario');
const campos = [
  { id: 'alergies', etiqueta: 'Al·lèrgies', tipo: 'seleccion', requerido: false, multiple: true, opciones: ['Gluten', 'Lactosa'] },
  { id: 'acompanyants', etiqueta: 'Acompanyants', tipo: 'numero', requerido: true, min: 0, max: 4 },
];
console.log('definicio OK ->', validarDefinicionCampos(campos));
console.log('definicio KO ->', validarDefinicionCampos([{ id: 'x', etiqueta: '', tipo: 'numero' }]));
console.log('respostes OK ->', validarRespuestas(campos, { alergies: ['Gluten'], acompanyants: '2' }));
console.log('respostes KO (falta requerit) ->', validarRespuestas(campos, { alergies: ['Gluten'] }));
console.log('respostes KO (fora de rang) ->', validarRespuestas(campos, { acompanyants: 9 }));
"
```
Expected: `definicio OK -> []`, `definicio KO` amb almenys un error d'etiqueta, `respostes OK` amb `errors: []` i `acompanyants: 2` (número), `respostes KO (falta requerit)` amb l'error d'"Acompanyants" obligatori, `respostes KO (fora de rang)` amb l'error de màxim.

- [ ] **Step 3: Commit**

```bash
git add utils/camposFormulario.js
git commit -m "Millora: validació compartida dels camps de formulari personalitzats"
```

---

### Task 3: `models/Evento.js` — persistir `campos_formulario`

**Files:**
- Modify: `models/Evento.js`

**Interfaces:**
- Consumes: cap (mòdul intern).
- Produces: `Evento.create(data)` i `Evento.update(id, data)` accepten i retornen `campos_formulario` (array).

- [ ] **Step 1: Actualitzar `create`**

A `models/Evento.js:59-77`, amplia l'INSERT i el `RETURNING`/defaults:

```javascript
async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO eventos (nombre, nombre_es, nombre_en, fecha, descripcion, descripcion_es, descripcion_en, precio, aforo_total, fecha_limite_compra, estado, nombre_invitado, cargo_invitado, campos_formulario)
     VALUES (@nombre, @nombre_es, @nombre_en, @fecha, @descripcion, @descripcion_es, @descripcion_en, @precio, @aforo_total, @fecha_limite_compra, @estado, @nombre_invitado, @cargo_invitado, @campos_formulario)
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
    ...data,
    campos_formulario: JSON.stringify(data.campos_formulario || []),
  });
  return getById(info.lastInsertRowid);
}
```

- [ ] **Step 2: Actualitzar `update`**

A `models/Evento.js:79-104`, afegeix `campos_formulario` a la desestructuració i a l'UPDATE:

```javascript
async function update(id, data) {
  const actual = await getById(id);
  if (!actual) return null;
  const {
    nombre, nombre_es, nombre_en, fecha,
    descripcion, descripcion_es, descripcion_en,
    precio, aforo_total, fecha_limite_compra, estado,
    nombre_invitado, cargo_invitado, campos_formulario,
  } = { ...actual, ...data };
  await db
    .prepare(
      `UPDATE eventos SET nombre=@nombre, nombre_es=@nombre_es, nombre_en=@nombre_en, fecha=@fecha,
         descripcion=@descripcion, descripcion_es=@descripcion_es, descripcion_en=@descripcion_en,
         precio=@precio, aforo_total=@aforo_total,
         fecha_limite_compra=@fecha_limite_compra, estado=@estado,
         nombre_invitado=@nombre_invitado, cargo_invitado=@cargo_invitado,
         campos_formulario=@campos_formulario
       WHERE id=@id`
    )
    .run({
      nombre, nombre_es, nombre_en, fecha,
      descripcion, descripcion_es, descripcion_en,
      precio, aforo_total, fecha_limite_compra, estado, id,
      nombre_invitado, cargo_invitado,
      campos_formulario: JSON.stringify(campos_formulario || []),
    });
  return getById(id);
}
```

Nota: `actual.campos_formulario` ja ve com a array JS (pg parseja JSONB automàticament), així que `{ ...actual, ...data }` funciona igual que amb la resta de camps.

- [ ] **Step 3: Verificar manualment**

Run (amb `DATABASE_URL` apuntant a la BD de desenvolupament):
```bash
node -e "
const Evento = require('./models/Evento');
(async () => {
  const ev = await Evento.create({
    nombre: 'Test camps', fecha: new Date(Date.now() + 86400000).toISOString(),
    precio: 1000, aforo_total: 10, fecha_limite_compra: new Date(Date.now() + 3600000).toISOString(),
    campos_formulario: [{ id: 'a', etiqueta: 'Al·lèrgies', tipo: 'texto', requerido: false }],
  });
  console.log('creat ->', ev.campos_formulario);
  const actualitzat = await Evento.update(ev.id, { campos_formulario: [] });
  console.log('actualitzat ->', actualitzat.campos_formulario);
  process.exit(0);
})();
"
```
Expected: `creat -> [ { id: 'a', etiqueta: 'Al·lèrgies', tipo: 'texto', requerido: false } ]`, `actualitzat -> []`.

- [ ] **Step 4: Commit**

```bash
git add models/Evento.js
git commit -m "Millora: Evento persisteix els camps de formulari personalitzats"
```

---

### Task 4: `models/Compra.js` — `respuestas_campos` i `edit_token`

**Files:**
- Modify: `models/Compra.js`

**Interfaces:**
- Produces:
  - `Compra.create(data)` accepta `respuestas_campos` i genera `edit_token` automàticament.
  - `Compra.findByEditToken(token)` → compra o `undefined`.
  - `Compra.updateRespuestas(id, respuestas)` → compra actualitzada.

- [ ] **Step 1: Afegir `require('crypto')` i generar el token a `create`**

A `models/Compra.js:1-2`, afegeix:

```javascript
const crypto = require('crypto');
const db = require('../config/db');
```

Substitueix la funció `create` (`models/Compra.js:19-38`) per:

```javascript
async function create(data) {
  const stmt = db.prepare(
    `INSERT INTO compras (
       evento_id, nombre_comprador, email, telefono, cantidad, importe_total,
       quiere_factura, nif, nombre_fiscal, direccion_fiscal, estado_pago,
       respuestas_campos, edit_token
     ) VALUES (
       @evento_id, @nombre_comprador, @email, @telefono, @cantidad, @importe_total,
       @quiere_factura, @nif, @nombre_fiscal, @direccion_fiscal, 'pendiente',
       @respuestas_campos, @edit_token
     ) RETURNING id`
  );
  const info = await stmt.run({
    nif: null,
    nombre_fiscal: null,
    direccion_fiscal: null,
    telefono: null,
    ...data,
    quiere_factura: !!data.quiere_factura,
    respuestas_campos: JSON.stringify(data.respuestas_campos || {}),
    edit_token: crypto.randomBytes(24).toString('hex'),
  });
  return getById(info.lastInsertRowid);
}
```

- [ ] **Step 2: Afegir `findByEditToken` i `updateRespuestas`**

Afegeix després de `findBySessionId` (`models/Compra.js:44-46`):

```javascript
async function findByEditToken(token) {
  return db.prepare('SELECT * FROM compras WHERE edit_token = ?').get(token);
}

async function updateRespuestas(id, respuestas) {
  await db
    .prepare('UPDATE compras SET respuestas_campos = ? WHERE id = ?')
    .run(JSON.stringify(respuestas || {}), id);
  return getById(id);
}
```

- [ ] **Step 3: Exportar les noves funcions**

A `models/Compra.js:92-102`, afegeix `findByEditToken` i `updateRespuestas` a `module.exports`.

- [ ] **Step 4: Verificar manualment**

Run:
```bash
node -e "
const Compra = require('./models/Compra');
(async () => {
  const c = await Compra.create({
    evento_id: 1, nombre_comprador: 'Prova', email: 'a@b.com', cantidad: 1, importe_total: 1000,
    respuestas_campos: { alergies: ['Gluten'] },
  });
  console.log('token generat?', typeof c.edit_token === 'string' && c.edit_token.length === 48);
  const trobat = await Compra.findByEditToken(c.edit_token);
  console.log('trobat per token ->', trobat.id === c.id);
  const actualitzat = await Compra.updateRespuestas(c.id, { alergies: [] });
  console.log('respostes buidades ->', actualitzat.respuestas_campos);
  process.exit(0);
})();
"
```
(Requereix que ja existeixi un `eventos.id = 1` a la BD de desenvolupament; si no, crea'n un abans amb `Evento.create`.)
Expected: `token generat? true`, `trobat per token -> true`, `respostes buidades -> {}`.

- [ ] **Step 5: Commit**

```bash
git add models/Compra.js
git commit -m "Millora: Compra desa respostes de formulari i genera token d'edició"
```

---

### Task 5: Admin — validar i desar `campos_formulario`

**Files:**
- Modify: `controllers/adminController.js`

**Interfaces:**
- Consumes: `validarDefinicionCampos` de `utils/camposFormulario.js` (Task 2).
- Produces: `crearEvento`/`actualitzarEvento` retornen 400 amb detalls si `campos_formulario` és invàlid; en cas contrari es desa.

- [ ] **Step 1: Importar el validador**

A `controllers/adminController.js:1-4`, afegeix:

```javascript
const { validarDefinicionCampos } = require('../utils/camposFormulario');
```

- [ ] **Step 2: Validar dins `crearEvento`**

A `controllers/adminController.js:97-99`, abans de cridar `Evento.create`, després de `validarEvento`:

```javascript
async function crearEvento(req, res) {
  const errors = validarEvento(req.body);
  const camposFormulario = Array.isArray(req.body.campos_formulario) ? req.body.campos_formulario : [];
  errors.push(...validarDefinicionCampos(camposFormulario));
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });
```

I dins la crida a `Evento.create` (línia ~117), afegeix `campos_formulario: camposFormulario,` a l'objecte passat.

- [ ] **Step 3: Validar dins `actualitzarEvento`**

A `controllers/adminController.js:135-141`:

```javascript
async function actualitzarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const actual = await Evento.getById(id);
  if (!actual) return res.status(404).json({ error: 'no_trobat' });

  const errors = validarEvento(req.body, { parcial: true });
  if (req.body.campos_formulario !== undefined) {
    errors.push(...validarDefinicionCampos(req.body.campos_formulario));
  }
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });
```

I abans de `const evento = await Evento.update(id, canvis);` (línia ~176), afegeix:

```javascript
  if (req.body.campos_formulario !== undefined) {
    canvis.campos_formulario = req.body.campos_formulario;
  }
```

- [ ] **Step 4: Verificar manualment amb l'endpoint real**

Amb el servidor arrencat (`node server.js`) i una sessió d'admin vàlida (cookie `admin_session`):
```bash
curl -s -X POST http://localhost:3000/api/admin/eventos \
  -H "Content-Type: application/json" -H "Cookie: admin_session=<token vàlid>" \
  -d '{"nombre":"Test","fecha":"2027-01-01T20:00:00.000Z","precio":1000,"aforo_total":10,"fecha_limite_compra":"2026-12-01T20:00:00.000Z","campos_formulario":[{"id":"x","etiqueta":"","tipo":"texto"}]}'
```
Expected: `400` amb `detalls` incloent l'error d'etiqueta buida (per `validarDefinicionCampos`). Amb una etiqueta vàlida, `201` i la resposta inclou `campos_formulario`.

- [ ] **Step 5: Commit**

```bash
git add controllers/adminController.js
git commit -m "Millora: validació i persistència dels camps de formulari des de l'admin"
```

---

### Task 6: Admin — columnes dinàmiques a la taula de compres i al CSV

**Files:**
- Modify: `controllers/adminController.js`

**Interfaces:**
- Consumes: `evento.campos_formulario`, `compra.respuestas_campos`.
- Produces: `exportarComprasCsv` inclou una columna per camp definit a l'esdeveniment.

- [ ] **Step 1: Generar columnes dinàmiques al CSV**

A `controllers/adminController.js:233-249`, substitueix `exportarComprasCsv`:

```javascript
async function exportarComprasCsv(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = await Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const compres = await Compra.listByEvento(eventoId);
  const camposEvento = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];

  const columnesCampos = camposEvento.map((campo) => ({
    clau: `campo_${campo.id}`,
    capsalera: campo.etiqueta,
  }));

  const files = compres.map((c) => {
    const respuestas = c.respuestas_campos || {};
    const filaCampos = {};
    camposEvento.forEach((campo) => {
      const valor = respuestas[campo.id];
      filaCampos[`campo_${campo.id}`] = Array.isArray(valor) ? valor.join(', ') : (valor ?? '');
    });
    return {
      ...c,
      ...filaCampos,
      importe_total_eur: (c.importe_total / 100).toFixed(2),
      quiere_factura_text: c.quiere_factura ? 'Sí' : 'No',
    };
  });

  const csv = toCsv(files, [...COLUMNES_CSV, ...columnesCampos]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="compres-evento-${eventoId}.csv"`);
  res.send(csv);
}
```

(`llistarCompresEvento`, `controllers/adminController.js:201-206`, ja retorna les compres senceres — `respuestas_campos` hi arriba sense canvis.)

- [ ] **Step 2: Verificar manualment**

Amb una compra existent que tingui `respuestas_campos`, crida `GET /api/admin/eventos/:id/compras/export.csv` amb cookie d'admin i comprova que el CSV té una columna extra amb l'etiqueta del camp i el valor correcte (revisa manualment el contingut descarregat).

- [ ] **Step 3: Commit**

```bash
git add controllers/adminController.js
git commit -m "Millora: CSV de compres inclou les respostes dels camps personalitzats"
```

---

### Task 7: Admin UI — CRUD de camps a `evento.html`

**Files:**
- Modify: `public/admin/evento.html`
- Modify: `public/js/admin.js`

**Interfaces:**
- Consumes: `evento.campos_formulario` (GET), envia `campos_formulario` dins el body de `PUT /api/admin/eventos/:id` i `POST /api/admin/eventos`.
- Produces: variable de mòdul `camposFormularioActuals` (array) sincronitzada amb la UI, inclosa al `body` del `submit`.

- [ ] **Step 1: Afegir la secció HTML**

A `public/admin/evento.html`, després del tancament de `</div>` de `camps-fiscals`... en realitat aquest projecte no té `camps-fiscals` a evento.html — insereix la secció nova abans de la línia `<button type="submit" class="btn-primary">Desar canvis</button>` (`public/admin/evento.html:83`):

```html
    <div class="camps-formulari-secció">
      <h2 class="camps-formulari-titol">Formulari de compra</h2>
      <p class="camps-formulari-ajuda">Camps addicionals que el comprador respon abans de pagar (ex: al·lèrgies, talla).</p>
      <div id="llista-camps-formulari"></div>
      <button type="button" id="btn-afegir-camp" class="btn-secundari">+ Afegir camp</button>
    </div>

    <div id="modal-camp-formulari" class="modal-camp-formulari hidden">
      <div class="modal-camp-formulari-cos">
        <label for="camp-etiqueta">Etiqueta</label>
        <input type="text" id="camp-etiqueta">

        <label for="camp-tipo">Tipus</label>
        <select id="camp-tipo">
          <option value="texto">Text lliure</option>
          <option value="numero">Número</option>
          <option value="seleccion">Selecció d'opcions</option>
        </select>

        <div id="camp-opcions-numero" class="hidden">
          <label for="camp-unidad">Unitat (opcional)</label>
          <input type="text" id="camp-unidad">
          <label for="camp-min">Mínim</label>
          <input type="number" id="camp-min">
          <label for="camp-max">Màxim</label>
          <input type="number" id="camp-max">
        </div>

        <div id="camp-opcions-seleccion" class="hidden">
          <label>Opcions</label>
          <div id="llista-opcions-camp"></div>
          <button type="button" id="btn-afegir-opcio-camp" class="btn-secundari">+ Afegir opció</button>
          <div class="checkbox-row">
            <input type="checkbox" id="camp-multiple">
            <label for="camp-multiple">Permet triar-ne diverses</label>
          </div>
        </div>

        <div class="checkbox-row">
          <input type="checkbox" id="camp-requerido">
          <label for="camp-requerido">Camp obligatori</label>
        </div>

        <div class="modal-camp-formulari-accions">
          <button type="button" id="btn-cancelar-camp" class="btn-secundari">Cancel·la</button>
          <button type="button" id="btn-desar-camp" class="btn-primary">Desa el camp</button>
        </div>
        <p id="error-camp-formulari" class="form-error"></p>
      </div>
    </div>
```

- [ ] **Step 2: Estat i renderitzat a `admin.js`**

A `public/js/admin.js`, dins el bloc `if (formEventoEditar) { ... }` (`public/js/admin.js:859-1005`), afegeix just abans de `async function carregarEvento() {` (línia 906):

```javascript
  let camposFormularioActuals = [];
  let indexCampEditant = null;

  function generarIdCamp() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function etiquetaTipo(tipo) {
    return { texto: 'Text lliure', numero: 'Número', seleccion: 'Selecció' }[tipo] || tipo;
  }

  function renderLlistaCamps() {
    const cont = document.getElementById('llista-camps-formulari');
    cont.innerHTML = '';
    if (camposFormularioActuals.length === 0) {
      cont.innerHTML = '<p class="camps-formulari-buit">Encara no hi ha cap camp definit.</p>';
      return;
    }
    camposFormularioActuals.forEach((campo, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-camp-formulari';
      fila.innerHTML = `
        <span class="fila-camp-formulari-etiqueta">${escapeHtml(campo.etiqueta)}</span>
        <span class="fila-camp-formulari-tipus">${etiquetaTipo(campo.tipo)}${campo.requerido ? ' · Obligatori' : ''}</span>
        <button type="button" data-accio="pujar" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" data-accio="baixar" data-i="${i}" ${i === camposFormularioActuals.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" data-accio="editar" data-i="${i}">✎</button>
        <button type="button" data-accio="eliminar" data-i="${i}">🗑</button>
      `;
      cont.appendChild(fila);
    });

    cont.querySelectorAll('button[data-accio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const accio = btn.dataset.accio;
        if (accio === 'pujar' && i > 0) {
          [camposFormularioActuals[i - 1], camposFormularioActuals[i]] = [camposFormularioActuals[i], camposFormularioActuals[i - 1]];
          renderLlistaCamps();
        } else if (accio === 'baixar' && i < camposFormularioActuals.length - 1) {
          [camposFormularioActuals[i + 1], camposFormularioActuals[i]] = [camposFormularioActuals[i], camposFormularioActuals[i + 1]];
          renderLlistaCamps();
        } else if (accio === 'eliminar') {
          camposFormularioActuals.splice(i, 1);
          renderLlistaCamps();
        } else if (accio === 'editar') {
          obrirModalCamp(i);
        }
      });
    });
  }

  function renderOpcionsModal(opciones) {
    const cont = document.getElementById('llista-opcions-camp');
    cont.innerHTML = '';
    opciones.forEach((opcio, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-opcio-camp';
      fila.innerHTML = `<input type="text" value="${escapeHtml(opcio)}" data-i="${i}"><button type="button" data-i="${i}">✕</button>`;
      cont.appendChild(fila);
    });
    cont.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        opcionsModalActuals.splice(parseInt(btn.dataset.i, 10), 1);
        renderOpcionsModal(opcionsModalActuals);
      });
    });
    cont.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        opcionsModalActuals[parseInt(input.dataset.i, 10)] = input.value;
      });
    });
  }

  let opcionsModalActuals = [];

  function obrirModalCamp(i) {
    indexCampEditant = i === undefined ? null : i;
    const campo = i === undefined ? null : camposFormularioActuals[i];
    document.getElementById('camp-etiqueta').value = campo ? campo.etiqueta : '';
    document.getElementById('camp-tipo').value = campo ? campo.tipo : 'texto';
    document.getElementById('camp-unidad').value = campo && campo.unidad ? campo.unidad : '';
    document.getElementById('camp-min').value = campo && campo.min !== undefined ? campo.min : '';
    document.getElementById('camp-max').value = campo && campo.max !== undefined ? campo.max : '';
    document.getElementById('camp-requerido').checked = !!(campo && campo.requerido);
    document.getElementById('camp-multiple').checked = !!(campo && campo.multiple);
    opcionsModalActuals = campo && Array.isArray(campo.opciones) ? [...campo.opciones] : [];
    renderOpcionsModal(opcionsModalActuals);
    document.getElementById('error-camp-formulari').textContent = '';
    actualitzarVisibilitatTipusModal();
    document.getElementById('modal-camp-formulari').classList.remove('hidden');
  }

  function actualitzarVisibilitatTipusModal() {
    const tipo = document.getElementById('camp-tipo').value;
    document.getElementById('camp-opcions-numero').classList.toggle('hidden', tipo !== 'numero');
    document.getElementById('camp-opcions-seleccion').classList.toggle('hidden', tipo !== 'seleccion');
  }

  document.getElementById('camp-tipo').addEventListener('change', actualitzarVisibilitatTipusModal);
  document.getElementById('btn-afegir-camp').addEventListener('click', () => obrirModalCamp(undefined));
  document.getElementById('btn-cancelar-camp').addEventListener('click', () => {
    document.getElementById('modal-camp-formulari').classList.add('hidden');
  });
  document.getElementById('btn-afegir-opcio-camp').addEventListener('click', () => {
    opcionsModalActuals.push('');
    renderOpcionsModal(opcionsModalActuals);
  });

  document.getElementById('btn-desar-camp').addEventListener('click', () => {
    const errorEl = document.getElementById('error-camp-formulari');
    const etiqueta = document.getElementById('camp-etiqueta').value.trim();
    const tipo = document.getElementById('camp-tipo').value;
    if (!etiqueta) {
      errorEl.textContent = 'Cal una etiqueta per al camp.';
      return;
    }
    if (tipo === 'seleccion' && opcionsModalActuals.filter((o) => o.trim()).length === 0) {
      errorEl.textContent = 'Cal almenys una opció.';
      return;
    }
    const campo = {
      id: indexCampEditant !== null ? camposFormularioActuals[indexCampEditant].id : generarIdCamp(),
      etiqueta,
      tipo,
      requerido: document.getElementById('camp-requerido').checked,
    };
    if (tipo === 'numero') {
      const unidad = document.getElementById('camp-unidad').value.trim();
      const min = document.getElementById('camp-min').value;
      const max = document.getElementById('camp-max').value;
      if (unidad) campo.unidad = unidad;
      if (min !== '') campo.min = parseFloat(min);
      if (max !== '') campo.max = parseFloat(max);
    }
    if (tipo === 'seleccion') {
      campo.opciones = opcionsModalActuals.map((o) => o.trim()).filter(Boolean);
      campo.multiple = document.getElementById('camp-multiple').checked;
    }

    if (indexCampEditant !== null) {
      camposFormularioActuals[indexCampEditant] = campo;
    } else {
      camposFormularioActuals.push(campo);
    }
    document.getElementById('modal-camp-formulari').classList.add('hidden');
    renderLlistaCamps();
  });
```

- [ ] **Step 3: Carregar i desar dins el flux existent**

A `carregarEvento()` (`public/js/admin.js:906-928`), just abans de tancar la funció, afegeix:

```javascript
    camposFormularioActuals = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];
    renderLlistaCamps();
```

Al `submit` de `formEventoEditar` (`public/js/admin.js:930-949`), afegeix al `body`:

```javascript
      campos_formulario: camposFormularioActuals,
```

- [ ] **Step 4: Estils bàsics**

A `public/css/admin.css`, afegeix al final:

```css
.camps-formulari-secció{margin:24px 0;padding:16px;border:1px solid var(--dark-muted);border-radius:8px;}
.camps-formulari-titol{font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;}
.camps-formulari-ajuda{font-size:13px;color:var(--dark-muted);margin:0 0 12px;}
.camps-formulari-buit{font-size:13px;color:var(--dark-muted);}
.fila-camp-formulari{display:grid;grid-template-columns:1fr auto auto auto auto auto;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--dark-muted);}
.modal-camp-formulari{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:50;}
.modal-camp-formulari.hidden{display:none;}
.modal-camp-formulari-cos{background:#fff;padding:24px;border-radius:8px;max-width:420px;width:90%;max-height:85vh;overflow:auto;}
.modal-camp-formulari-accions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
.fila-opcio-camp{display:flex;gap:8px;margin-bottom:6px;}
.fila-opcio-camp input{flex:1;}
```

- [ ] **Step 5: Verificar manualment al navegador**

Arrenca el servidor, obre `admin/evento.html?id=<id>` amb sessió d'admin, afegeix un camp de cada tipus, desa, recarrega la pàgina i comprova que els camps persisteixen amb els valors correctes.

- [ ] **Step 6: Commit**

```bash
git add public/admin/evento.html public/js/admin.js public/css/admin.css
git commit -m "Millora: constructor de camps personalitzats a l'admin d'esdeveniments"
```

---

### Task 8: Exposar `campos_formulario` al formulari públic

**Files:**
- Modify: `controllers/eventoController.js`

**Interfaces:**
- Produces: `GET /api/evento/actual` retorna `evento.campos_formulario` quan `disponible: true`.

- [ ] **Step 1: Afegir el camp a la resposta**

A `controllers/eventoController.js:61-74`, dins l'objecte `evento` de la resposta, afegeix:

```javascript
      campos_formulario: Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [],
```

- [ ] **Step 2: Verificar manualment**

```bash
curl -s "http://localhost:3000/api/evento/actual" | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).evento.campos_formulario))"
```
Expected: mostra l'array de camps de l'esdeveniment actiu (buit si no se n'ha definit cap).

- [ ] **Step 3: Commit**

```bash
git add controllers/eventoController.js
git commit -m "Millora: exposa els camps de formulari a l'API pública d'esdeveniment"
```

---

### Task 9: Formulari públic de compra — renderitzat dinàmic

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/checkout.js`

**Interfaces:**
- Consumes: `ev.campos_formulario` (de `carregarEvento`, Task 8).
- Produces: `respuestas_campos` inclòs al `body` de `POST /api/checkout/crear`.

- [ ] **Step 1: Contenidor al formulari**

A `public/index.html:87-90` (abans del bloc `camps-fiscals`), afegeix:

```html
      <div id="camps-formulari-dinamics"></div>
```

- [ ] **Step 2: Renderitzar-los a `checkout.js`**

A `public/js/checkout.js`, afegeix després de `actualitzarBarraAforo(ev.aforo_disponible, ev.aforo_total);` dins `carregarEvento` (línia 180):

```javascript
  renderCampsFormulariDinamics(ev.campos_formulario || []);
```

I abans de `function calcularAforo` (línia 185), afegeix les funcions noves:

```javascript
let campsFormulariActuals = [];

function renderCampsFormulariDinamics(campos) {
  campsFormulariActuals = campos;
  const cont = document.getElementById('camps-formulari-dinamics');
  cont.innerHTML = '';
  campos.forEach((campo) => {
    const wrap = document.createElement('div');
    wrap.className = 'camp-dinamic';

    if (campo.tipo === 'texto') {
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</label>
        <input type="text" id="camp_${campo.id}" ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'numero') {
      const min = campo.min !== undefined ? `min="${campo.min}"` : '';
      const max = campo.max !== undefined ? `max="${campo.max}"` : '';
      const unitat = campo.unidad ? ` (${escapeHtml(campo.unidad)})` : '';
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${unitat}${campo.requerido ? ' *' : ''}</label>
        <input type="number" id="camp_${campo.id}" ${min} ${max} ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'seleccion') {
      const inputType = campo.multiple ? 'checkbox' : 'radio';
      const opcions = (campo.opciones || []).map((op, i) => `
        <label class="opcio-dinamica">
          <input type="${inputType}" name="camp_${campo.id}" value="${escapeHtml(op)}" ${campo.requerido && !campo.multiple ? 'required' : ''}>
          ${escapeHtml(op)}
        </label>
      `).join('');
      wrap.innerHTML = `<span class="camp-dinamic-etiqueta">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</span>${opcions}`;
    }

    cont.appendChild(wrap);
  });
}

function llegirRespostesCampsDinamics() {
  const respostes = {};
  campsFormulariActuals.forEach((campo) => {
    if (campo.tipo === 'texto') {
      respostes[campo.id] = document.getElementById(`camp_${campo.id}`).value;
    } else if (campo.tipo === 'numero') {
      const v = document.getElementById(`camp_${campo.id}`).value;
      if (v !== '') respostes[campo.id] = parseFloat(v);
    } else if (campo.tipo === 'seleccion') {
      const marcats = Array.from(document.querySelectorAll(`input[name="camp_${campo.id}"]:checked`)).map((i) => i.value);
      respostes[campo.id] = campo.multiple ? marcats : (marcats[0] || '');
    }
  });
  return respostes;
}
```

- [ ] **Step 3: Enviar les respostes en comprar**

A `enviarFormulari` (`public/js/checkout.js:315-335`), afegeix al `body`:

```javascript
    respuestas_campos: llegirRespostesCampsDinamics(),
```

- [ ] **Step 4: Estils bàsics**

A `public/css/style.css`, afegeix:

```css
.camp-dinamic{margin-bottom:16px;}
.camp-dinamic label,.camp-dinamic-etiqueta{display:block;margin-bottom:4px;font-weight:500;}
.opcio-dinamica{display:flex;align-items:center;gap:6px;font-weight:400;margin-bottom:4px;}
```

- [ ] **Step 5: Verificar manualment al navegador**

Amb un esdeveniment que tingui camps definits (Task 7), obre `index.html`, comprova que apareixen sota les dades del comprador, que els `required` bloquegen l'enviament si es deixen buits, i que el número respecta `min`/`max` (l'atribut HTML natiu ja ho valida al navegador).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/js/checkout.js public/css/style.css
git commit -m "Millora: formulari de compra públic renderitza els camps personalitzats"
```

---

### Task 10: Backend de compra — validar i desar `respuestas_campos`

**Files:**
- Modify: `controllers/stripeController.js`

**Interfaces:**
- Consumes: `validarRespuestas` de `utils/camposFormulario.js` (Task 2).
- Produces: `crearCheckoutSession` retorna 400 si les respostes no compleixen la definició; en cas contrari les desa a la Compra.

- [ ] **Step 1: Importar el validador**

A `controllers/stripeController.js:1-4`, afegeix:

```javascript
const { validarRespuestas } = require('../utils/camposFormulario');
```

- [ ] **Step 2: Validar després de comprovar l'aforament**

A `controllers/stripeController.js:91-98`, després del bloc de `disponibles`/`aforament_insuficient` i abans de calcular `importeTotal`:

```javascript
    const { errors: errorsCamps, respuestasNormalizadas } = validarRespuestas(
      evento.campos_formulario || [],
      req.body.respuestas_campos
    );
    if (errorsCamps.length) {
      return res.status(400).json({ error: 'dades_invalides', detalls: errorsCamps });
    }
```

- [ ] **Step 3: Desar-les a la Compra**

A la crida `Compra.create` (`controllers/stripeController.js:102-113`), afegeix:

```javascript
      respuestas_campos: respuestasNormalizadas,
```

- [ ] **Step 4: Verificar manualment**

Amb un esdeveniment amb un camp `numero` `requerido` amb `max: 4`, crida:
```bash
curl -s -X POST http://localhost:3000/api/checkout/crear -H "Content-Type: application/json" \
  -d '{"evento_id":<id>,"cantidad":1,"nombre_comprador":"Test","email":"a@b.com","accepta_condicions":true,"respuestas_campos":{"acompanyants":9}}'
```
Expected: `400` amb `detalls` incloent l'error de màxim superat. Amb un valor vàlid, `200` amb la `url` de Stripe Checkout, i la compra creada a la BD té `respuestas_campos` amb el valor normalitzat.

- [ ] **Step 5: Commit**

```bash
git add controllers/stripeController.js
git commit -m "Millora: valida i desa les respostes dels camps personalitzats en crear la compra"
```

---

### Task 11: Enllaç d'edició a l'email de confirmació

**Files:**
- Modify: `utils/mailer.js`
- Modify: `controllers/stripeController.js`

**Interfaces:**
- Consumes: `compra.edit_token`, `evento.fecha`.
- Produces: `enviarEmailConfirmacio` rep un `baseUrl` i inclou l'enllaç `mis-datos.html?token=...` a l'HTML, només si l'esdeveniment encara no ha passat.

- [ ] **Step 1: Ampliar `enviarEmailConfirmacio`**

A `utils/mailer.js:25-63`, canvia la signatura i afegeix el bloc de l'enllaç:

```javascript
async function enviarEmailConfirmacio({ compra, evento, baseUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('No s\'ha pogut enviar l\'email de confirmació: falta RESEND_API_KEY.');
    return;
  }

  const dadesFactura = compra.quiere_factura
    ? `<p><strong>Dades de facturació</strong><br>
       ${compra.nombre_fiscal}<br>
       NIF/CIF: ${compra.nif}<br>
       ${compra.direccion_fiscal}</p>`
    : '';

  const enllacEdicio = compra.edit_token && new Date() < new Date(evento.fecha)
    ? `<p>Pots revisar o modificar les teves dades (com les al·lèrgies) fins al dia de l'esdeveniment des d'aquest enllaç: <br>
       <a href="${baseUrl}/mis-datos.html?token=${compra.edit_token}">${baseUrl}/mis-datos.html?token=${compra.edit_token}</a></p>`
    : '';

  const html = `
    <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
      <h1 style="font-size:20px;">Reserva confirmada</h1>
      <p>Hola ${compra.nombre_comprador},</p>
      <p>La teva compra per a <strong>${evento.nombre}</strong> ha quedat confirmada.</p>
      <ul>
        <li><strong>Data i hora:</strong> ${formatDataHora(evento.fecha)}</li>
        <li><strong>Entrades:</strong> ${compra.cantidad}</li>
        <li><strong>Import total:</strong> ${formatEuros(compra.importe_total)}</li>
      </ul>
      ${dadesFactura}
      ${enllacEdicio}
      <p>Ens veiem a l'esdeveniment!</p>
    </div>
  `;

  try {
    await client().emails.send({
      from: process.env.RESEND_FROM,
      to: compra.email,
      subject: `Confirmació de la teva entrada — ${evento.nombre}`,
      html,
    });
  } catch (err) {
    console.error('Error enviant l\'email de confirmació via Resend:', err);
  }
}
```

- [ ] **Step 2: Passar `baseUrl` des del webhook**

A `controllers/stripeController.js`, dins `webhook` (`controllers/stripeController.js:194-207`), on es crida `enviarEmailConfirmacio`, calcula el `baseUrl` igual que a `crearCheckoutSession`:

```javascript
    case 'checkout.session.completed': {
      const session = event.data.object;
      const compra = await Compra.findBySessionId(session.id);
      if (compra && compra.estado_pago !== 'pagado') {
        await Compra.marcarPagado(compra.id);
        console.log(`Compra #${compra.id} marcada com a pagada.`);
        const evento = await Evento.getById(compra.evento_id);
        if (evento) {
          const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
          await enviarEmailConfirmacio({ compra: { ...compra, estado_pago: 'pagado' }, evento, baseUrl });
        }
      }
      break;
    }
```

- [ ] **Step 3: Verificar manualment**

Completa una compra de prova de cap a cap (targeta de test de Stripe) amb un esdeveniment futur i confirma que l'email rebut inclou l'enllaç `mis-datos.html?token=...`. Amb un esdeveniment ja passat (data `fecha` anterior a ara), confirma que l'enllaç no apareix.

- [ ] **Step 4: Commit**

```bash
git add utils/mailer.js controllers/stripeController.js
git commit -m "Millora: email de confirmació inclou enllaç per editar dades del formulari"
```

---

### Task 12: Endpoint públic `mis-datos`

**Files:**
- Create: `controllers/misDatosController.js`
- Modify: `routes/publicRoutes.js`

**Interfaces:**
- Consumes: `Compra.findByEditToken`, `Compra.updateRespuestas` (Task 4), `validarRespuestas` (Task 2).
- Produces: `GET /api/mis-datos/:token`, `PUT /api/mis-datos/:token`.

- [ ] **Step 1: Escriure el controlador**

```javascript
const Compra = require('../models/Compra');
const Evento = require('../models/Evento');
const { validarRespuestas } = require('../utils/camposFormulario');

function eventoJaPassat(evento) {
  return new Date() > new Date(evento.fecha);
}

/**
 * GET /api/mis-datos/:token
 * Accés sense login: el token és l'únic secret. Es retorna només el
 * mínim necessari per pintar el formulari d'edició (mai dades d'altres
 * compres ni de l'esdeveniment sencer).
 */
async function obtenerMisDatos(req, res) {
  const compra = await Compra.findByEditToken(req.params.token);
  if (!compra) return res.status(404).json({ error: 'enllac_no_valid' });

  const evento = await Evento.getById(compra.evento_id);
  if (!evento) return res.status(404).json({ error: 'enllac_no_valid' });

  res.json({
    evento: { nombre: evento.nombre, fecha: evento.fecha },
    editable: !eventoJaPassat(evento),
    campos_formulario: Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [],
    respuestas_campos: compra.respuestas_campos || {},
  });
}

/**
 * PUT /api/mis-datos/:token
 * Revalida sempre contra la definició vigent de l'esdeveniment (pot haver
 * canviat des de la compra).
 */
async function actualizarMisDatos(req, res) {
  const compra = await Compra.findByEditToken(req.params.token);
  if (!compra) return res.status(404).json({ error: 'enllac_no_valid' });

  const evento = await Evento.getById(compra.evento_id);
  if (!evento) return res.status(404).json({ error: 'enllac_no_valid' });

  if (eventoJaPassat(evento)) {
    return res.status(403).json({ error: 'esdeveniment_ja_passat' });
  }

  const campos = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];
  const { errors, respuestasNormalizadas } = validarRespuestas(campos, req.body.respuestas_campos);
  if (errors.length) {
    return res.status(400).json({ error: 'dades_invalides', detalls: errors });
  }

  const actualitzada = await Compra.updateRespuestas(compra.id, respuestasNormalizadas);
  res.json({ respuestas_campos: actualitzada.respuestas_campos });
}

module.exports = { obtenerMisDatos, actualizarMisDatos };
```

- [ ] **Step 2: Registrar les rutes**

A `routes/publicRoutes.js`, afegeix:

```javascript
const { obtenerMisDatos, actualizarMisDatos } = require('../controllers/misDatosController');
```

I després de la línia de `checkout/confirmacion` (`routes/publicRoutes.js:13`):

```javascript
router.get('/api/mis-datos/:token', asyncHandler(obtenerMisDatos));
router.put('/api/mis-datos/:token', asyncHandler(actualizarMisDatos));
```

- [ ] **Step 3: Verificar manualment**

Amb un `edit_token` real d'una compra existent:
```bash
curl -s "http://localhost:3000/api/mis-datos/<token>"
curl -s -X PUT "http://localhost:3000/api/mis-datos/<token>" -H "Content-Type: application/json" -d '{"respuestas_campos":{"alergies":["Lactosa"]}}'
curl -s "http://localhost:3000/api/mis-datos/token-inexistent"
```
Expected: primer `GET` retorna les dades; `PUT` retorna les respostes actualitzades; l'últim `GET` amb token fals retorna `404` amb `enllac_no_valid`. Amb un esdeveniment de `fecha` passada, el `PUT` retorna `403` amb `esdeveniment_ja_passat`.

- [ ] **Step 4: Commit**

```bash
git add controllers/misDatosController.js routes/publicRoutes.js
git commit -m "Millora: endpoint públic per editar les respostes del formulari via token"
```

---

### Task 13: Pàgina pública `mis-datos.html`

**Files:**
- Create: `public/mis-datos.html`
- Create: `public/js/mis-datos.js`

**Interfaces:**
- Consumes: `GET`/`PUT /api/mis-datos/:token` (Task 12).

- [ ] **Step 1: Crear la pàgina**

```html
<!doctype html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Les meves dades — Espai Econòmic</title>
<link rel="icon" href="/assets/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<main class="card" data-layout="info-left" style="min-height:auto;">
  <section class="panel panel-color evento-info">
    <div class="logo"><span class="logo-icon"></span><span>Espai Econòmic</span></div>
    <div>
      <span class="eyebrow">Les teves dades</span>
      <h1 id="evento-nombre-misdatos">Carregant…</h1>
      <p id="evento-data-misdatos"></p>
    </div>
    <div></div>
  </section>
  <section class="panel panel-white" style="justify-content:center; align-items:flex-start;">
    <h1 style="font-size:24px;">Revisa o modifica les teves dades</h1>
    <div id="estat-misdatos" class="estat-missatge hidden" role="status" aria-live="polite"></div>
    <form id="form-misdatos" class="hidden">
      <div id="camps-formulari-misdatos"></div>
      <button type="submit" class="btn-primary">Desar canvis</button>
      <p id="error-misdatos" class="form-error" role="alert" aria-live="polite"></p>
      <p id="ok-misdatos" class="form-ok hidden" role="status">Dades desades correctament.</p>
    </form>
  </section>
</main>
<script src="/js/mis-datos.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear el JS (reutilitzant el patró de `checkout.js`)**

```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function token() {
  return new URLSearchParams(window.location.search).get('token');
}

let campsActuals = [];

function renderCamps(campos, respuestas) {
  const cont = document.getElementById('camps-formulari-misdatos');
  cont.innerHTML = '';
  campos.forEach((campo) => {
    const valor = respuestas[campo.id];
    const wrap = document.createElement('div');
    wrap.className = 'camp-dinamic';

    if (campo.tipo === 'texto') {
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</label>
        <input type="text" id="camp_${campo.id}" value="${escapeHtml(valor || '')}" ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'numero') {
      const min = campo.min !== undefined ? `min="${campo.min}"` : '';
      const max = campo.max !== undefined ? `max="${campo.max}"` : '';
      const unitat = campo.unidad ? ` (${escapeHtml(campo.unidad)})` : '';
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${unitat}${campo.requerido ? ' *' : ''}</label>
        <input type="number" id="camp_${campo.id}" value="${valor !== undefined ? valor : ''}" ${min} ${max} ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'seleccion') {
      const seleccionats = campo.multiple ? (valor || []) : [valor];
      const inputType = campo.multiple ? 'checkbox' : 'radio';
      const opcions = (campo.opciones || []).map((op) => `
        <label class="opcio-dinamica">
          <input type="${inputType}" name="camp_${campo.id}" value="${escapeHtml(op)}" ${seleccionats.includes(op) ? 'checked' : ''}>
          ${escapeHtml(op)}
        </label>
      `).join('');
      wrap.innerHTML = `<span class="camp-dinamic-etiqueta">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</span>${opcions}`;
    }

    cont.appendChild(wrap);
  });
  campsActuals = campos;
}

function llegirRespostes() {
  const respostes = {};
  campsActuals.forEach((campo) => {
    if (campo.tipo === 'texto') {
      respostes[campo.id] = document.getElementById(`camp_${campo.id}`).value;
    } else if (campo.tipo === 'numero') {
      const v = document.getElementById(`camp_${campo.id}`).value;
      if (v !== '') respostes[campo.id] = parseFloat(v);
    } else if (campo.tipo === 'seleccion') {
      const marcats = Array.from(document.querySelectorAll(`input[name="camp_${campo.id}"]:checked`)).map((i) => i.value);
      respostes[campo.id] = campo.multiple ? marcats : (marcats[0] || '');
    }
  });
  return respostes;
}

async function iniciar() {
  const t = token();
  const avis = document.getElementById('estat-misdatos');
  if (!t) {
    avis.textContent = 'Aquest enllaç no és vàlid.';
    avis.classList.remove('hidden');
    return;
  }

  const res = await fetch(`/api/mis-datos/${t}`);
  if (!res.ok) {
    avis.textContent = 'Aquest enllaç no és vàlid.';
    avis.classList.remove('hidden');
    return;
  }
  const data = await res.json();

  document.getElementById('evento-nombre-misdatos').textContent = data.evento.nombre;
  document.getElementById('evento-data-misdatos').textContent = new Date(data.evento.fecha).toLocaleString('ca-ES');

  if (!data.editable) {
    avis.textContent = 'Ja no es poden modificar les dades, l\'esdeveniment ja ha tingut lloc.';
    avis.classList.remove('hidden');
    return;
  }

  renderCamps(data.campos_formulario, data.respuestas_campos || {});
  document.getElementById('form-misdatos').classList.remove('hidden');

  document.getElementById('form-misdatos').addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('error-misdatos');
    const okEl = document.getElementById('ok-misdatos');
    errorEl.textContent = '';
    okEl.classList.add('hidden');

    const resPut = await fetch(`/api/mis-datos/${t}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas_campos: llegirRespostes() }),
    });
    const dataPut = await resPut.json();
    if (resPut.ok) {
      okEl.classList.remove('hidden');
    } else {
      errorEl.textContent = (dataPut.detalls || ['No s\'han pogut desar els canvis.']).join(', ');
    }
  });
}

iniciar();
```

- [ ] **Step 2: Verificar manualment al navegador**

Obre `mis-datos.html?token=<edit_token real>`, comprova que es carreguen els valors actuals, que es poden modificar i desar, i que amb un token inexistent es mostra el missatge d'enllaç no vàlid.

- [ ] **Step 3: Commit**

```bash
git add public/mis-datos.html public/js/mis-datos.js
git commit -m "Millora: pàgina pública per editar les respostes del formulari de compra"
```

---

## Self-Review (fet en escriure aquest pla)

- **Cobertura de l'spec:** model de dades (Task 1, 3, 4), flux de compra (Task 8, 9, 10), edició posterior (Task 4, 11, 12, 13), constructor admin (Task 7), validació admin (Task 5), visualització admin/CSV (Task 6), gestió d'errors (integrada a cada task: 404 token invàlid, 403 esdeveniment passat, 400 validació) — totes cobertes.
- **Sense placeholders:** cada step té codi complet, sense "TBD" ni referències a tasques anteriors sense repetir el codi.
- **Consistència de tipus:** `campos_formulario` sempre array de `{id, etiqueta, tipo, requerido, unidad?, min?, max?, opciones?, multiple?}`; `respuestas_campos` sempre objecte `{[id]: valor}`; noms de funcions (`validarDefinicionCampos`, `validarRespuestas`, `findByEditToken`, `updateRespuestas`) coincideixen entre la seva definició (Task 2/4) i tots els usos posteriors (Task 5, 10, 12).
