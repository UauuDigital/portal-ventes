# Panell d'administració (CRUD esdeveniments + compres) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afegir un panell d'administració protegit per login que permeti fer CRUD d'esdeveniments i gestionar (llistar/cancel·lar/exportar CSV) les compres associades.

**Architecture:** Backend Express amb rutes noves (`/admin/login`, `/admin/logout`, `/api/admin/*`) protegides per una cookie de sessió signada amb HMAC (sense estat al servidor, sense dependències noves). Frontend: pàgines HTML/JS vanilla noves a `public/admin/`, seguint el mateix patró que el checkout públic (`public/js/checkout.js` crida una API JSON).

**Tech Stack:** Node.js + Express, `node:sqlite`, `node:crypto`, `node:test` (test runner integrat, sense dependència nova) per als tests unitaris de les utilitats pures.

## Global Constraints

- Node ≥ 22.5 (ja requerit al projecte).
- **Cap dependència npm nova.** Tot es fa amb mòduls integrats de Node (`crypto`, `test`, `assert`) i el que ja hi ha (`express`).
- Tots els preus/imports es guarden i tracten en **cèntims** (enters), igual que la resta del projecte.
- Comentaris i textos d'interfície en català; noms de camps de base de dades i alguns identificadors de model es mantenen en castellà per coherència amb l'schema existent (`eventos`, `compras`, `nombre`, `estado_pago`, etc.) — segueix exactament el mateix criteri que ja fa servir la resta del codi.
- Estil visual: reutilitza `public/css/style.css` (paleta `#221F1E`/`#F2EFEE`, tipografia Inter/Ogg, `.btn-primary`, inputs ja definits). No es crea cap sistema de disseny nou.
- "Esborrar" un esdeveniment = `estado: 'cerrado'` (esborrat tou). No es toca `config/schema.sql`.
- Spec de referència: `docs/superpowers/specs/2026-07-13-panell-admin-design.md`.

---

## Task 1: Utilitat de cookie de sessió signada

**Files:**
- Create: `utils/sessionCookie.js`
- Test: `tests/sessionCookie.test.js`
- Modify: `package.json` (afegir script `test`)
- Modify: `.env.example` (afegir `SESSION_SECRET`)

**Interfaces:**
- Produces: `crearCookieSessio(usuari: string): string` — retorna el valor de la cookie (`"<payload_base64url>.<signatura_base64url>"`).
- Produces: `verificarCookieSessio(valor: string): { usuari: string } | null` — retorna les dades si la cookie és vàlida i no ha expirat, `null` altrament.

- [ ] **Step 1: Afegir `SESSION_SECRET` a `.env.example`**

Edita `.env.example` i afegeix, sota el bloc `ADMIN_USER`/`ADMIN_PASS`:

```
# Secret per signar la cookie de sessió del panell d'administració (HMAC-SHA256).
# Genera'n un de llarg i aleatori, per exemple amb: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=canvia-aquest-secret-per-un-de-llarg-i-aleatori
```

- [ ] **Step 2: Afegir l'script de test a `package.json`**

Modifica la secció `"scripts"` de `package.json` perquè quedi:

```json
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "seed": "node scripts/seed.js",
    "test": "node --test tests/"
  },
```

- [ ] **Step 3: Escriure els tests (han de fallar perquè el mòdul encara no existeix)**

Crea `tests/sessionCookie.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'secret-de-proves-nomes-per-tests';

const { crearCookieSessio, verificarCookieSessio } = require('../utils/sessionCookie');

test('crea i verifica una cookie vàlida', () => {
  const cookie = crearCookieSessio('admin');
  const dades = verificarCookieSessio(cookie);
  assert.deepEqual(dades, { usuari: 'admin' });
});

test('rebutja una cookie amb signatura manipulada', () => {
  const cookie = crearCookieSessio('admin');
  const [payload] = cookie.split('.');
  const manipulada = `${payload}.signaturafalsa`;
  assert.equal(verificarCookieSessio(manipulada), null);
});

test('rebutja una cookie amb payload manipulat', () => {
  const cookie = crearCookieSessio('admin');
  const [, signatura] = cookie.split('.');
  const payloadFals = Buffer.from(JSON.stringify({ usuari: 'algu-altre', exp: Date.now() + 100000 })).toString('base64url');
  assert.equal(verificarCookieSessio(`${payloadFals}.${signatura}`), null);
});

test('rebutja una cookie expirada', () => {
  const payloadExpirat = Buffer.from(JSON.stringify({ usuari: 'admin', exp: Date.now() - 1000 })).toString('base64url');
  const crypto = require('node:crypto');
  const signatura = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payloadExpirat).digest('base64url');
  assert.equal(verificarCookieSessio(`${payloadExpirat}.${signatura}`), null);
});

test('rebutja valors mal formats', () => {
  assert.equal(verificarCookieSessio(''), null);
  assert.equal(verificarCookieSessio('nopunt'), null);
  assert.equal(verificarCookieSessio(null), null);
});
```

- [ ] **Step 4: Executar els tests i comprovar que fallen**

Run: `npm test`
Expected: FAIL amb un error tipus `Cannot find module '../utils/sessionCookie'`

- [ ] **Step 5: Implementar `utils/sessionCookie.js`**

```js
const crypto = require('node:crypto');

const HORES_EXPIRACIO = 8;

function firmar(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta SESSION_SECRET a .env');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function crearCookieSessio(usuari) {
  const exp = Date.now() + HORES_EXPIRACIO * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ usuari, exp })).toString('base64url');
  const signatura = firmar(payload);
  return `${payload}.${signatura}`;
}

function verificarCookieSessio(valor) {
  if (!valor || typeof valor !== 'string' || !valor.includes('.')) return null;

  const [payload, signatura] = valor.split('.');
  if (!payload || !signatura) return null;

  const esperada = firmar(payload);
  const bufEsperada = Buffer.from(esperada);
  const bufRebuda = Buffer.from(signatura);
  if (bufEsperada.length !== bufRebuda.length || !crypto.timingSafeEqual(bufEsperada, bufRebuda)) {
    return null;
  }

  let dades;
  try {
    dades = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!dades.usuari || !dades.exp || Date.now() > dades.exp) return null;
  return { usuari: dades.usuari };
}

module.exports = { crearCookieSessio, verificarCookieSessio };
```

- [ ] **Step 6: Executar els tests i comprovar que passen**

Run: `npm test`
Expected: PASS — 5 tests, 0 failures

- [ ] **Step 7: Commit**

```bash
git add utils/sessionCookie.js tests/sessionCookie.test.js package.json .env.example
git commit -m "feat: utilitat de cookie de sessio signada per al panell d'admin"
```

---

## Task 2: Utilitat de generació de CSV

**Files:**
- Create: `utils/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Produces: `toCsv(files: object[], columnes: { clau: string, capsalera: string }[]): string` — retorna el contingut CSV complet (capçalera + files, separador `,`, finals de línia `\r\n`, camps amb `,`/`"`/salt de línia escapats entre cometes dobles).

- [ ] **Step 1: Escriure els tests**

Crea `tests/csv.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv } = require('../utils/csv');

const columnes = [
  { clau: 'nom', capsalera: 'Nom' },
  { clau: 'importe', capsalera: 'Import' },
];

test('genera capçalera i files simples', () => {
  const csv = toCsv([{ nom: 'Anna', importe: '35.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\nAnna,35.00\r\n');
});

test('escapa camps amb comes entre cometes dobles', () => {
  const csv = toCsv([{ nom: 'Cognom, Nom', importe: '10.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\n"Cognom, Nom",10.00\r\n');
});

test('escapa cometes dobles duplicant-les', () => {
  const csv = toCsv([{ nom: 'Dit "el Petit"', importe: '10.00' }], columnes);
  assert.equal(csv, 'Nom,Import\r\n"Dit ""el Petit""",10.00\r\n');
});

test('tracta null/undefined com a camp buit', () => {
  const csv = toCsv([{ nom: null, importe: undefined }], columnes);
  assert.equal(csv, 'Nom,Import\r\n,\r\n');
});

test('sense files retorna només la capçalera', () => {
  const csv = toCsv([], columnes);
  assert.equal(csv, 'Nom,Import\r\n');
});
```

- [ ] **Step 2: Executar els tests i comprovar que fallen**

Run: `npm test`
Expected: FAIL amb `Cannot find module '../utils/csv'`

- [ ] **Step 3: Implementar `utils/csv.js`**

```js
function escaparCamp(valor) {
  const text = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(files, columnes) {
  const capsalera = columnes.map((c) => escaparCamp(c.capsalera)).join(',');
  const linies = files.map((fila) => columnes.map((c) => escaparCamp(fila[c.clau])).join(','));
  return [capsalera, ...linies].join('\r\n') + '\r\n';
}

module.exports = { toCsv };
```

- [ ] **Step 4: Executar els tests i comprovar que passen**

Run: `npm test`
Expected: PASS — 10 tests en total (5 anteriors + 5 nous), 0 failures

- [ ] **Step 5: Commit**

```bash
git add utils/csv.js tests/csv.test.js
git commit -m "feat: utilitat de generacio de CSV per exportar compres"
```

---

## Task 3: Backend de login/logout (auth)

**Files:**
- Create: `middleware/authMiddleware.js`
- Create: `controllers/authController.js`
- Create: `routes/adminRoutes.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `crearCookieSessio`, `verificarCookieSessio` de `utils/sessionCookie.js` (Task 1).
- Produces: middleware `requireAuth(req, res, next)` — respon `401 { error: 'no_autenticat' }` si no hi ha sessió vàlida; si n'hi ha, defineix `req.adminUser` i crida `next()`.
- Produces: middleware `requireAuthPage(req, res, next)` — igual que `requireAuth` però, en lloc de `401`, fa `res.redirect('/admin/login.html')`.
- Produces rutes: `POST /admin/login`, `POST /admin/logout`.

- [ ] **Step 1: Implementar `middleware/authMiddleware.js`**

```js
const { verificarCookieSessio } = require('../utils/sessionCookie');

function llegirSessio(req) {
  const capçalera = req.headers.cookie || '';
  const match = capçalera.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return null;
  return verificarCookieSessio(decodeURIComponent(match[1]));
}

function requireAuth(req, res, next) {
  const sessio = llegirSessio(req);
  if (!sessio) return res.status(401).json({ error: 'no_autenticat' });
  req.adminUser = sessio.usuari;
  next();
}

function requireAuthPage(req, res, next) {
  const sessio = llegirSessio(req);
  if (!sessio) return res.redirect('/admin/login.html');
  req.adminUser = sessio.usuari;
  next();
}

module.exports = { requireAuth, requireAuthPage };
```

- [ ] **Step 2: Implementar `controllers/authController.js`**

```js
const crypto = require('node:crypto');
const { crearCookieSessio } = require('../utils/sessionCookie');

const VUIT_HORES_MS = 8 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function login(req, res) {
  const { usuari, contrasenya } = req.body || {};
  const usuariOk = safeEqual(usuari || '', process.env.ADMIN_USER || '');
  const passOk = safeEqual(contrasenya || '', process.env.ADMIN_PASS || '');

  if (!usuariOk || !passOk) {
    return res.status(401).json({ error: 'credencials_invalides' });
  }

  const valor = crearCookieSessio(process.env.ADMIN_USER);
  res.cookie('admin_session', valor, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VUIT_HORES_MS,
  });
  res.json({ ok: true });
}

function logout(req, res) {
  res.clearCookie('admin_session');
  res.json({ ok: true });
}

module.exports = { login, logout };
```

- [ ] **Step 3: Crear `routes/adminRoutes.js` (només login/logout per ara)**

```js
const express = require('express');
const router = express.Router();

const { login, logout } = require('../controllers/authController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

module.exports = router;
```

- [ ] **Step 4: Muntar `adminRoutes` a `server.js`**

Modifica `server.js`: afegeix la importació sota `publicRoutes` i munta el router després de `express.json()`:

```js
const adminRoutes = require('./routes/adminRoutes');
```

```js
app.use(express.json());
app.use(adminRoutes);
app.use(express.static(path.join(__dirname, 'public')));
```

(Substitueix les línies 16-17 originals, que passen a ser 3 línies.)

- [ ] **Step 5: Provar manualment amb el servidor arrencat**

Assegura't que `.env` té `SESSION_SECRET`, `ADMIN_USER` i `ADMIN_PASS` (copia'ls de `.env.example` si cal, amb valors reals per a proves locals).

Run: `npm run dev` (en background)

Run (en un altre terminal, PowerShell):
```powershell
$body = @{ usuari = $env:ADMIN_USER; contrasenya = $env:ADMIN_PASS } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/admin/login -Method Post -Body $body -ContentType "application/json" -SessionVariable sessio
```
Expected: status `200`, resposta `{"ok":true}`, i `$sessio.Cookies` ha de contenir una cookie `admin_session`.

Run amb credencials incorrectes:
```powershell
$body = @{ usuari = "mal"; contrasenya = "mal" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/admin/login -Method Post -Body $body -ContentType "application/json" -SkipHttpErrorCheck
```
Expected: status `401`, resposta `{"error":"credencials_invalides"}`

- [ ] **Step 6: Commit**

```bash
git add middleware/authMiddleware.js controllers/authController.js routes/adminRoutes.js server.js
git commit -m "feat: login/logout del panell d'admin amb cookie de sessio"
```

---

## Task 4: CRUD d'esdeveniments (API)

**Files:**
- Modify: `models/Evento.js` (afegir `listAll`)
- Create: `controllers/adminController.js`
- Modify: `routes/adminRoutes.js`

**Interfaces:**
- Consumes: `Evento.getById`, `Evento.create`, `Evento.update` (ja existents a `models/Evento.js`), `requireAuth` (Task 3).
- Produces: `Evento.listAll(): object[]`.
- Produces rutes: `GET /api/admin/eventos`, `GET /api/admin/eventos/:id`, `POST /api/admin/eventos`, `PUT /api/admin/eventos/:id` (totes protegides amb `requireAuth`).

- [ ] **Step 1: Afegir `listAll` a `models/Evento.js`**

Afegeix aquesta funció abans de `module.exports` a `models/Evento.js`:

```js
function listAll() {
  return db.prepare('SELECT * FROM eventos ORDER BY fecha DESC').all();
}
```

I actualitza la línia final:

```js
module.exports = { getActivo, getById, create, update, listAll };
```

- [ ] **Step 2: Crear `controllers/adminController.js` (part d'esdeveniments)**

```js
const Evento = require('../models/Evento');
const Compra = require('../models/Compra');
const { toCsv } = require('../utils/csv');

function validarEvento(body, { parcial } = {}) {
  const errors = [];
  const cal = (camp) => !parcial || body[camp] !== undefined;

  if (cal('nombre') && (!body.nombre || String(body.nombre).trim().length < 3)) {
    errors.push('nombre invàlid');
  }
  if (cal('fecha') && Number.isNaN(new Date(body.fecha).getTime())) {
    errors.push('fecha invàlida');
  }
  if (cal('precio')) {
    const precio = parseInt(body.precio, 10);
    if (!Number.isInteger(precio) || precio <= 0) errors.push('precio invàlid');
  }
  if (cal('aforo_total')) {
    const aforo = parseInt(body.aforo_total, 10);
    if (!Number.isInteger(aforo) || aforo <= 0) errors.push('aforo_total invàlid');
  }
  if (cal('fecha_limite_compra') && Number.isNaN(new Date(body.fecha_limite_compra).getTime())) {
    errors.push('fecha_limite_compra invàlida');
  }
  if (body.fecha && body.fecha_limite_compra) {
    if (new Date(body.fecha_limite_compra) > new Date(body.fecha)) {
      errors.push('fecha_limite_compra ha de ser anterior o igual a fecha');
    }
  }
  if (body.estado !== undefined && !['abierto', 'cerrado'].includes(body.estado)) {
    errors.push('estado invàlid');
  }

  return errors;
}

function llistarEventos(req, res) {
  res.json(Evento.listAll());
}

function obtenirEvento(req, res) {
  const evento = Evento.getById(parseInt(req.params.id, 10));
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  res.json(evento);
}

function crearEvento(req, res) {
  const errors = validarEvento(req.body);
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const evento = Evento.create({
    nombre: String(req.body.nombre).trim(),
    fecha: new Date(req.body.fecha).toISOString(),
    descripcion: req.body.descripcion ? String(req.body.descripcion).trim() : null,
    precio: parseInt(req.body.precio, 10),
    aforo_total: parseInt(req.body.aforo_total, 10),
    fecha_limite_compra: new Date(req.body.fecha_limite_compra).toISOString(),
    estado: req.body.estado || 'abierto',
  });
  res.status(201).json(evento);
}

function actualitzarEvento(req, res) {
  const id = parseInt(req.params.id, 10);
  const actual = Evento.getById(id);
  if (!actual) return res.status(404).json({ error: 'no_trobat' });

  const errors = validarEvento(req.body, { parcial: true });
  if (errors.length) return res.status(400).json({ error: 'dades_invalides', detalls: errors });

  const canvis = {};
  ['nombre', 'descripcion', 'estado'].forEach((camp) => {
    if (req.body[camp] !== undefined) canvis[camp] = req.body[camp];
  });
  if (req.body.precio !== undefined) canvis.precio = parseInt(req.body.precio, 10);
  if (req.body.aforo_total !== undefined) canvis.aforo_total = parseInt(req.body.aforo_total, 10);
  if (req.body.fecha !== undefined) canvis.fecha = new Date(req.body.fecha).toISOString();
  if (req.body.fecha_limite_compra !== undefined) {
    canvis.fecha_limite_compra = new Date(req.body.fecha_limite_compra).toISOString();
  }

  const evento = Evento.update(id, canvis);
  res.json(evento);
}

module.exports = {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
};
```

- [ ] **Step 3: Muntar les rutes d'esdeveniments a `routes/adminRoutes.js`**

Substitueix tot el contingut de `routes/adminRoutes.js` per:

```js
const express = require('express');
const router = express.Router();

const { login, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
} = require('../controllers/adminController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

router.get('/api/admin/eventos', requireAuth, llistarEventos);
router.get('/api/admin/eventos/:id', requireAuth, obtenirEvento);
router.post('/api/admin/eventos', requireAuth, crearEvento);
router.put('/api/admin/eventos/:id', requireAuth, actualitzarEvento);

module.exports = router;
```

- [ ] **Step 4: Provar manualment (servidor arrencat, sessió ja iniciada del Task 3)**

Amb la variable `$sessio` de PowerShell del pas anterior (o torna a fer login):

```powershell
$body = @{
  nombre = "Sopar de prova admin"
  fecha = (Get-Date).AddDays(40).ToString("o")
  descripcion = "Creat des del panell d'admin"
  precio = 4000
  aforo_total = 30
  fecha_limite_compra = (Get-Date).AddDays(35).ToString("o")
} | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/admin/eventos -Method Post -Body $body -ContentType "application/json" -WebSession $sessio
```
Expected: status `201`, JSON amb l'esdeveniment creat i `id`.

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/admin/eventos -WebSession $sessio
```
Expected: status `200`, array JSON amb almenys els dos esdeveniments (el del seed i el nou).

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/admin/eventos -SkipHttpErrorCheck
```
Expected (sense cookie de sessió): status `401`.

- [ ] **Step 5: Commit**

```bash
git add models/Evento.js controllers/adminController.js routes/adminRoutes.js
git commit -m "feat: CRUD d'esdeveniments a l'API d'administracio"
```

---

## Task 5: Gestió de compres des de l'admin (API)

**Files:**
- Modify: `controllers/adminController.js`
- Modify: `routes/adminRoutes.js`

**Interfaces:**
- Consumes: `Compra.listByEvento`, `Compra.getById`, `Compra.marcarCancelado` (ja existents a `models/Compra.js`), `toCsv` (Task 2).
- Produces rutes: `GET /api/admin/eventos/:id/compras`, `POST /api/admin/compras/:id/cancelar`, `GET /api/admin/eventos/:id/compras/export.csv` (totes protegides amb `requireAuth`).

- [ ] **Step 1: Afegir les funcions de compres a `controllers/adminController.js`**

Afegeix aquest import a la capçalera del fitxer (ja hi ha `Compra` i `toCsv` importats des del Task 4; si no hi fossin, afegeix-los):

```js
const Compra = require('../models/Compra');
const { toCsv } = require('../utils/csv');
```

Afegeix aquestes funcions abans de `module.exports`:

```js
function llistarCompresEvento(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });
  res.json(Compra.listByEvento(eventoId));
}

function cancelarCompra(req, res) {
  const id = parseInt(req.params.id, 10);
  const compra = Compra.getById(id);
  if (!compra) return res.status(404).json({ error: 'no_trobat' });
  if (['cancelado', 'reembolsado'].includes(compra.estado_pago)) {
    return res.status(409).json({ error: 'operacio_no_aplicable' });
  }
  Compra.marcarCancelado(id);
  res.json(Compra.getById(id));
}

const COLUMNES_CSV = [
  { clau: 'nombre_comprador', capsalera: 'Nom' },
  { clau: 'email', capsalera: 'Email' },
  { clau: 'telefono', capsalera: 'Telèfon' },
  { clau: 'cantidad', capsalera: 'Quantitat' },
  { clau: 'importe_total_eur', capsalera: 'Import total (€)' },
  { clau: 'quiere_factura_text', capsalera: 'Factura' },
  { clau: 'nif', capsalera: 'NIF' },
  { clau: 'nombre_fiscal', capsalera: 'Nom fiscal' },
  { clau: 'direccion_fiscal', capsalera: 'Adreça fiscal' },
  { clau: 'estado_pago', capsalera: 'Estat pagament' },
  { clau: 'created_at', capsalera: 'Data compra' },
];

function exportarComprasCsv(req, res) {
  const eventoId = parseInt(req.params.id, 10);
  const evento = Evento.getById(eventoId);
  if (!evento) return res.status(404).json({ error: 'no_trobat' });

  const files = Compra.listByEvento(eventoId).map((c) => ({
    ...c,
    importe_total_eur: (c.importe_total / 100).toFixed(2),
    quiere_factura_text: c.quiere_factura ? 'Sí' : 'No',
  }));

  const csv = toCsv(files, COLUMNES_CSV);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="compres-evento-${eventoId}.csv"`);
  res.send(csv);
}
```

Actualitza `module.exports` perquè inclogui les tres funcions noves:

```js
module.exports = {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarComprasCsv,
};
```

- [ ] **Step 2: Muntar les rutes de compres a `routes/adminRoutes.js`**

Actualitza la importació de `adminController` i afegeix les rutes noves:

```js
const {
  llistarEventos,
  obtenirEvento,
  crearEvento,
  actualitzarEvento,
  llistarCompresEvento,
  cancelarCompra,
  exportarComprasCsv,
} = require('../controllers/adminController');
```

```js
router.get('/api/admin/eventos/:id/compras', requireAuth, llistarCompresEvento);
router.post('/api/admin/compras/:id/cancelar', requireAuth, cancelarCompra);
router.get('/api/admin/eventos/:id/compras/export.csv', requireAuth, exportarComprasCsv);
```

- [ ] **Step 3: Crear una compra de prova per poder testejar**

Amb el servidor aturat (per evitar bloquejos de fitxer SQLite), executa:

```powershell
node -e "require('dotenv').config(); const Compra = require('./models/Compra'); const Evento = require('./models/Evento'); const ev = Evento.listAll()[0]; console.log(Compra.create({ evento_id: ev.id, nombre_comprador: 'Prova Admin', email: 'prova@example.com', telefono: null, cantidad: 2, importe_total: ev.precio * 2, quiere_factura: false }));"
```
Expected: imprimeix un objecte JSON amb la compra creada (`estado_pago: 'pendiente'`).

Torna a arrencar `npm run dev`.

- [ ] **Step 4: Provar manualment els 3 endpoints nous**

(reutilitza `$sessio` de PowerShell dels passos anteriors; si ha expirat, torna a fer login com al Task 3)

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/eventos/1/compras" -WebSession $sessio
```
Expected: status `200`, array JSON amb la compra de prova.

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/eventos/1/compras/export.csv" -WebSession $sessio
```
Expected: status `200`, `Content-Type: text/csv`, body amb capçalera `Nom,Email,Telèfon,...` i la fila de la compra de prova.

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/compras/1/cancelar" -Method Post -WebSession $sessio
```
Expected: status `200`, JSON amb `estado_pago: "cancelado"`.

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/compras/1/cancelar" -Method Post -WebSession $sessio -SkipHttpErrorCheck
```
Expected (repetint la cancel·lació): status `409`, `{"error":"operacio_no_aplicable"}`.

- [ ] **Step 5: Commit**

```bash
git add controllers/adminController.js routes/adminRoutes.js
git commit -m "feat: gestio de compres (llistat, cancelacio, export CSV) a l'admin"
```

---

## Task 6: Frontend — pàgina de login i protecció de les pàgines estàtiques d'admin

**Files:**
- Create: `public/admin/login.html`
- Create: `public/css/admin.css`
- Create: `public/js/admin.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `requireAuthPage` de `middleware/authMiddleware.js` (Task 3), rutes `POST /admin/login` / `POST /admin/logout` (Task 3).
- Produces: contracte de pàgina — qualsevol pàgina `public/admin/*.html` (excepte `login.html`) requereix sessió vàlida; si no n'hi ha, redirigeix a `/admin/login.html`.

- [ ] **Step 1: Crear `public/css/admin.css`**

```css
.admin-login-card {
  max-width: 360px;
  width: 100%;
  background: var(--light);
  border-radius: var(--radius-card);
  box-shadow: 0 30px 60px -20px rgba(34, 31, 30, 0.35);
  padding: 40px;
}

.admin-login-card h1 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
  margin: 0 0 24px;
}

.admin-shell {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}

.admin-shell h1 {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 500;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--white);
  border-radius: 16px;
  overflow: hidden;
  margin: 24px 0;
  font-size: 13px;
}

.admin-table th,
.admin-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(34, 31, 30, 0.08);
}

.admin-table th {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--dark-muted);
}

.admin-form {
  background: var(--white);
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
}

.admin-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-link-back {
  color: var(--dark);
  font-size: 13px;
}

.btn-secundari {
  background: transparent;
  border: 1px solid rgba(34, 31, 30, 0.3);
  border-radius: var(--radius-pill);
  padding: 8px 16px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
```

- [ ] **Step 2: Crear `public/admin/login.html`**

```html
<!doctype html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accés administració — Espai Econòmic</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body>
<main class="admin-login-card">
  <h1>Accés administració</h1>
  <form id="form-login">
    <label for="usuari">Usuari</label>
    <input type="text" id="usuari" name="usuari" required autofocus>
    <label for="contrasenya">Contrasenya</label>
    <input type="password" id="contrasenya" name="contrasenya" required>
    <button type="submit" class="btn-primary">Entrar</button>
    <p id="error-login" style="color:#b3261e; font-size:12px; margin-top:10px; font-family:var(--font-sans);"></p>
  </form>
</main>
<script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Crear `public/js/admin.js` (només la part de login per ara)**

```js
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return null;
  }
  return res;
}

function formatEuros(centims) {
  return (centims / 100).toFixed(2) + ' €';
}

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuari = document.getElementById('usuari').value;
    const contrasenya = document.getElementById('contrasenya').value;
    const errorEl = document.getElementById('error-login');
    errorEl.textContent = '';

    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuari, contrasenya }),
    });

    if (res.ok) {
      window.location.href = '/admin/index.html';
    } else {
      errorEl.textContent = 'Usuari o contrasenya incorrectes.';
    }
  });
}
```

- [ ] **Step 4: Protegir les pàgines `public/admin/*.html` a `server.js`**

Modifica `server.js` perquè quedi (mostrant el bloc rellevant complet):

```js
const path = require('path');
const express = require('express');

const webhookRoutes = require('./routes/webhookRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { requireAuthPage } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(webhookRoutes);

app.use(express.json());
app.use(adminRoutes);

app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});
app.use('/admin', requireAuthPage, express.static(path.join(__dirname, 'public', 'admin')));

app.use(express.static(path.join(__dirname, 'public')));
app.use(publicRoutes);
```

Nota: `public/admin/login.html` ha de quedar fora de la carpeta servida per `express.static(path.join(__dirname, 'public'))` sense protecció — com que la ruta explícita `/admin/login.html` es registra ABANS del `app.use('/admin', requireAuthPage, ...)`, Express la intercepta primer i mai arriba a demanar auth. La resta de fitxers sota `/admin/*` (com `index.html` o `evento.html`, que es creen als Tasks 7 i 8) sí que passaran per `requireAuthPage`.

- [ ] **Step 5: Provar manualment amb el navegador**

Run: `npm run dev` (background)

Amb Claude in Chrome (o manualment):
1. Navega a `http://localhost:3000/admin/login.html` sense haver iniciat sessió → la pàgina ha de carregar amb normalitat (formulari visible).
2. Prova a navegar directament a `http://localhost:3000/admin/index.html` (encara no existeix el fitxer, però ha de redirigir a `/admin/login.html` igualment perquè `requireAuthPage` actua abans de buscar el fitxer) → hauries d'acabar a `/admin/login.html`.
3. Omple el formulari amb `ADMIN_USER`/`ADMIN_PASS` del `.env` i envia'l → hauria d'intentar redirigir a `/admin/index.html` (donarà 404 fins al Task 7, és esperat en aquest punt).
4. Prova amb credencials incorrectes → apareix el missatge "Usuari o contrasenya incorrectes." sota el formulari.

- [ ] **Step 6: Commit**

```bash
git add public/admin/login.html public/css/admin.css public/js/admin.js server.js
git commit -m "feat: pagina de login del panell d'admin i proteccio de rutes /admin"
```

---

## Task 7: Frontend — llistat i creació d'esdeveniments

**Files:**
- Create: `public/admin/index.html`
- Modify: `public/js/admin.js`

**Interfaces:**
- Consumes: `GET /api/admin/eventos`, `POST /api/admin/eventos` (Task 4), `apiFetch`/`formatEuros` (Task 6, ja al fitxer `admin.js`).

- [ ] **Step 1: Crear `public/admin/index.html`**

```html
<!doctype html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Esdeveniments — Administració Espai Econòmic</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body>
<div class="admin-shell">
  <div class="admin-topbar">
    <h1>Esdeveniments</h1>
    <button type="button" id="btn-logout" class="btn-secundari">Tanca sessió</button>
  </div>

  <table class="admin-table">
    <thead>
      <tr>
        <th>Nom</th>
        <th>Data</th>
        <th>Preu</th>
        <th>Aforament</th>
        <th>Estat</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="taula-eventos"></tbody>
  </table>

  <h2 style="font-family:var(--font-sans); font-size:14px; text-transform:uppercase; letter-spacing:0.05em; color:var(--dark-muted);">Crear esdeveniment</h2>
  <form id="form-evento" class="admin-form">
    <label for="nombre">Nom</label>
    <input type="text" id="nombre" name="nombre" required>

    <label for="fecha">Data de l'esdeveniment</label>
    <input type="datetime-local" id="fecha" name="fecha" required>

    <label for="descripcion">Descripció</label>
    <input type="text" id="descripcion" name="descripcion">

    <label for="precio">Preu (€)</label>
    <input type="number" id="precio" name="precio" min="0.01" step="0.01" required>

    <label for="aforo_total">Aforament total</label>
    <input type="number" id="aforo_total" name="aforo_total" min="1" step="1" required>

    <label for="fecha_limite_compra">Data límit de compra</label>
    <input type="datetime-local" id="fecha_limite_compra" name="fecha_limite_compra" required>

    <button type="submit" class="btn-primary">Crear esdeveniment</button>
    <p id="error-evento" style="color:#b3261e; font-size:12px; margin-top:10px; font-family:var(--font-sans);"></p>
  </form>
</div>
<script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Afegir la lògica de llistat/creació a `public/js/admin.js`**

Afegeix al final del fitxer:

```js
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await fetch('/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });
}

const taulaEventos = document.getElementById('taula-eventos');
if (taulaEventos) {
  async function carregarEventos() {
    const res = await apiFetch('/api/admin/eventos');
    if (!res) return;
    const eventos = await res.json();
    taulaEventos.innerHTML = '';
    eventos.forEach((ev) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ev.nombre}</td>
        <td>${new Date(ev.fecha).toLocaleString('ca-ES')}</td>
        <td>${formatEuros(ev.precio)}</td>
        <td>${ev.aforo_total}</td>
        <td>${ev.estado}</td>
        <td><a href="/admin/evento.html?id=${ev.id}">Veure</a></td>
      `;
      taulaEventos.appendChild(tr);
    });
  }

  const formEvento = document.getElementById('form-evento');
  formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento');
    errorEl.textContent = '';

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: new Date(document.getElementById('fecha_limite_compra').value).toISOString(),
    };

    const res = await apiFetch('/api/admin/eventos', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      formEvento.reset();
      carregarEventos();
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  carregarEventos();
}
```

- [ ] **Step 3: Provar manualment amb el navegador (Claude in Chrome)**

1. Fes login a `http://localhost:3000/admin/login.html` amb les credencials de `.env`.
2. Un cop a `/admin/index.html`, comprova que la taula mostra els esdeveniments existents (el del seed i el de proves del Task 4).
3. Omple el formulari de creació amb dades vàlides i envia'l → ha d'aparèixer una fila nova a la taula sense recarregar la pàgina.
4. Omple'l amb un preu de `0` → ha d'aparèixer el missatge d'error "precio invàlid" sota el formulari, sense crear res.
5. Clica "Tanca sessió" → ha de redirigir a `/admin/login.html`; si tornes a `/admin/index.html` directament, també t'hi ha de redirigir (sessió tancada).

- [ ] **Step 4: Commit**

```bash
git add public/admin/index.html public/js/admin.js
git commit -m "feat: llistat i creacio d'esdeveniments al panell d'admin"
```

---

## Task 8: Frontend — detall d'esdeveniment, edició, compres i exportació CSV

**Files:**
- Create: `public/admin/evento.html`
- Modify: `public/js/admin.js`

**Interfaces:**
- Consumes: `GET /api/admin/eventos/:id`, `PUT /api/admin/eventos/:id` (Task 4), `GET /api/admin/eventos/:id/compras`, `POST /api/admin/compras/:id/cancelar`, `GET /api/admin/eventos/:id/compras/export.csv` (Task 5).

- [ ] **Step 1: Crear `public/admin/evento.html`**

```html
<!doctype html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Detall d'esdeveniment — Administració Espai Econòmic</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body>
<div class="admin-shell">
  <div class="admin-topbar">
    <a href="/admin/index.html" class="admin-link-back">← Tots els esdeveniments</a>
    <button type="button" id="btn-logout" class="btn-secundari">Tanca sessió</button>
  </div>

  <h1 id="titol-evento">Carregant…</h1>

  <form id="form-evento-editar" class="admin-form">
    <label for="nombre">Nom</label>
    <input type="text" id="nombre" name="nombre" required>

    <label for="fecha">Data de l'esdeveniment</label>
    <input type="datetime-local" id="fecha" name="fecha" required>

    <label for="descripcion">Descripció</label>
    <input type="text" id="descripcion" name="descripcion">

    <label for="precio">Preu (€)</label>
    <input type="number" id="precio" name="precio" min="0.01" step="0.01" required>

    <label for="aforo_total">Aforament total</label>
    <input type="number" id="aforo_total" name="aforo_total" min="1" step="1" required>

    <label for="fecha_limite_compra">Data límit de compra</label>
    <input type="datetime-local" id="fecha_limite_compra" name="fecha_limite_compra" required>

    <label for="estado">Estat</label>
    <select id="estado" name="estado">
      <option value="abierto">Obert</option>
      <option value="cerrado">Tancat</option>
    </select>

    <button type="submit" class="btn-primary">Desar canvis</button>
    <p id="error-evento-editar" style="color:#b3261e; font-size:12px; margin-top:10px; font-family:var(--font-sans);"></p>
  </form>

  <div class="admin-topbar" style="margin-top:32px;">
    <h2 style="font-family:var(--font-sans); font-size:14px; text-transform:uppercase; letter-spacing:0.05em; color:var(--dark-muted);">Compres</h2>
    <a id="link-export-csv" class="btn-secundari" href="#">Exportar CSV</a>
  </div>

  <table class="admin-table">
    <thead>
      <tr>
        <th>Comprador</th>
        <th>Email</th>
        <th>Quantitat</th>
        <th>Import</th>
        <th>Estat</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="taula-compras"></tbody>
  </table>
</div>
<script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Afegir la lògica de detall/edició/compres a `public/js/admin.js`**

Afegeix al final del fitxer:

```js
function aInputDatetimeLocal(isoString) {
  const data = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

const formEventoEditar = document.getElementById('form-evento-editar');
if (formEventoEditar) {
  const params = new URLSearchParams(window.location.search);
  const eventoId = params.get('id');

  document.getElementById('link-export-csv').href = `/api/admin/eventos/${eventoId}/compras/export.csv`;

  async function carregarEvento() {
    const res = await apiFetch(`/api/admin/eventos/${eventoId}`);
    if (!res) return;
    if (!res.ok) {
      document.getElementById('titol-evento').textContent = 'Esdeveniment no trobat';
      return;
    }
    const evento = await res.json();
    document.getElementById('titol-evento').textContent = evento.nombre;
    document.getElementById('nombre').value = evento.nombre;
    document.getElementById('fecha').value = aInputDatetimeLocal(evento.fecha);
    document.getElementById('descripcion').value = evento.descripcion || '';
    document.getElementById('precio').value = (evento.precio / 100).toFixed(2);
    document.getElementById('aforo_total').value = evento.aforo_total;
    document.getElementById('fecha_limite_compra').value = aInputDatetimeLocal(evento.fecha_limite_compra);
    document.getElementById('estado').value = evento.estado;
  }

  formEventoEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento-editar');
    errorEl.textContent = '';

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: new Date(document.getElementById('fecha_limite_compra').value).toISOString(),
      estado: document.getElementById('estado').value,
    };

    const res = await apiFetch(`/api/admin/eventos/${eventoId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      carregarEvento();
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  const taulaCompras = document.getElementById('taula-compras');

  async function carregarCompras() {
    const res = await apiFetch(`/api/admin/eventos/${eventoId}/compras`);
    if (!res) return;
    const compras = await res.json();
    taulaCompras.innerHTML = '';
    compras.forEach((c) => {
      const potCancelar = ['pendiente', 'pagado'].includes(c.estado_pago);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.nombre_comprador}</td>
        <td>${c.email}</td>
        <td>${c.cantidad}</td>
        <td>${formatEuros(c.importe_total)}</td>
        <td>${c.estado_pago}</td>
        <td>${potCancelar ? `<button type="button" class="btn-cancelar-compra" data-id="${c.id}">Cancel·lar</button>` : ''}</td>
      `;
      taulaCompras.appendChild(tr);
    });

    taulaCompras.querySelectorAll('.btn-cancelar-compra').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res2 = await apiFetch(`/api/admin/compras/${btn.dataset.id}/cancelar`, { method: 'POST' });
        if (res2 && res2.ok) carregarCompras();
      });
    });
  }

  carregarEvento();
  carregarCompras();
}
```

- [ ] **Step 3: Provar manualment de cap a cap amb el navegador (Claude in Chrome)**

1. Amb sessió iniciada, des de `/admin/index.html` clica "Veure" en un esdeveniment → arribes a `/admin/evento.html?id=<id>` amb el formulari ja emplenat amb les seves dades.
2. Canvia el nom i el preu, desa els canvis → recarrega les dades i comprova que es reflecteixen.
3. Canvia l'estat a "Tancat" i desa → torna a `/admin/index.html` i comprova que la columna "Estat" mostra `cerrado`; comprova també que aquest esdeveniment ja no apareix com actiu a `http://localhost:3000/` (landing pública, `GET /api/evento/actual`).
4. A la taula de compres, comprova que la compra de prova (Task 5) hi apareix; clica "Cancel·lar" en una compra amb estat cancel·lable → l'estat canvia a `cancelado` i el botó desapareix.
5. Clica "Exportar CSV" → es descarrega un fitxer `.csv`; obre'l i comprova la capçalera i les files.

- [ ] **Step 4: Commit**

```bash
git add public/admin/evento.html public/js/admin.js
git commit -m "feat: detall, edicio i gestio de compres d'un esdeveniment al panell d'admin"
```

---

## Task 9: Documentació

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Actualitzar `README.md`**

A la secció `## Estructura`, actualitza el bloc de `routes/`, `controllers/`, `middleware/` i afegeix `utils/`:

```
config/       Connexió a la BD (node:sqlite) i schema SQL
models/       Evento i Compra (accés a dades)
controllers/  Lògica de negoci: esdeveniment actiu, checkout, webhook, admin
routes/       Rutes Express (públiques, webhook i admin)
middleware/   Rate limiting i autenticació del panell d'admin
utils/        Cookie de sessió signada i generació de CSV
public/       Landing + checkout + panell d'admin (HTML/CSS/JS vanilla)
scripts/      Script de seed per crear un esdeveniment de prova
data/         Fitxer SQLite (es genera automàticament, no es versiona)
```

Afegeix una secció nova després de `## Posada en marxa`:

```markdown
## Panell d'administració

Accessible a `/admin/login.html` amb les credencials `ADMIN_USER`/`ADMIN_PASS` de l'`.env` (cal també definir `SESSION_SECRET`, una cadena llarga i aleatòria, per signar la cookie de sessió). Permet:

- Crear i editar esdeveniments, i "tancar-los" (equivalent a esborrar-los: deixen d'acceptar compres però l'històric es manté).
- Veure el llistat de compres de cada esdeveniment i cancel·lar-ne manualment.
- Exportar les compres d'un esdeveniment a CSV.

La sessió és una cookie signada amb HMAC-SHA256 (`utils/sessionCookie.js`), sense estat al servidor ni dependències noves.
```

A la secció `## Pendent (fora d'abast d'aquesta primera entrega)`, elimina la línia:

```
- Panell d'administració (crear/editar esdeveniment, llistat de compres, exportació CSV, login).
```

- [ ] **Step 2: Executar tota la suite de tests un últim cop**

Run: `npm test`
Expected: PASS — 10 tests, 0 failures

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: documenta el panell d'administracio al README"
```
