# Eliminació del sistema multi-idioma — resum

El checkout públic passa de CA/ES/EN a ser exclusivament català. S'ha eliminat
tot el sistema: selector d'idioma, `i18n.js`, traducció automàtica via
MyMemory (`utils/traduccio.js`) i les columnes de BD corresponents.

## PASO 1 — Checkout públic

- **`public/index.html`, `public/success.html`, `public/cancel.html`**:
  eliminats tots els atributs `data-i18n`/`data-i18n-html`/`data-i18n-aria`
  (el text català que ja hi havia com a contingut visible es manté tal
  qual, ara fix). Eliminat el `<script src="/js/i18n.js">`.
- **`public/avis-legal.html`, `public/condicions.html`, `public/cookies.html`,
  `public/privacitat.html`**: aquestes pàgines tenien els `<h2>`/`<p>` buits
  i depenien 100% de `i18n.js` per omplir el text en JS. S'ha copiat
  literalment el text de la secció `ca:` de `i18n.js` a l'HTML (sense
  improvisar cap traducció nova) i eliminat el `<script>`.
- **`public/js/checkout.js`**: eliminada `t()`/`localeActual()` basades en
  `window.i18n`; substituïdes per un objecte `TEXTOS` fix en català i
  `LOCALE = 'ca-ES'`. Eliminat `?lang=` de totes les crides a
  `/api/evento/actual` i `/api/evento/actius`. Eliminat el listener de
  `idiomaCanviat` (ja no hi ha res que el dispari).
- **`public/js/success.js`**: mateix patró, `localeActual()` → constant
  `LOCALE`. Eliminat el listener `idiomaCanviat`.
- **`public/js/legal-modal.js`**: eliminada la dependència de `window.i18n`
  pels textos "Carregant…" / "No s'ha pogut carregar el contingut." (ara
  fixos en català).
- **`public/js/i18n.js`**: eliminat per complet.
- **CSS mort eliminat**: `.menu-idioma` (regla òrfena a `public/css/layout.css`,
  el selector d'idioma s'injectava dinàmicament des de `i18n.js`, que ja no
  existeix).

## PASO 2 — Backend

- **`controllers/eventoController.js`**: eliminat `idiomaSollicitat()`,
  `textSegonsIdioma()`, `nomSegonsIdioma()`, `descripcioSegonsIdioma()` i
  `IDIOMES_SUPORTATS`. Els endpoints `GET /api/evento/actual` i
  `GET /api/evento/actius` ja no llegeixen `?lang=` i sempre retornen
  `nombre`/`descripcion` directament del registre (català, sense variants).
- **`controllers/adminController.js`**: eliminada la funció `traduirNom`
  (endpoint `POST /api/admin/traduir-nom`), `resoldreTraduccions()`, i totes
  les crides a `traduirNomEsdeveniment`/`traduirATotsIdiomes` a
  `crearEvento`/`actualitzarEvento`. Ja no es genera `nombre_es`/`nombre_en`/
  `descripcion_es`/`descripcion_en` en crear ni editar un esdeveniment.
- **`utils/traduccio.js`**: eliminat per complet.
- **`routes/adminRoutes.js`**: eliminada la ruta
  `POST /api/admin/traduir-nom` i el seu import.
- **`models/Evento.js`**: eliminats `nombre_es`, `nombre_en`,
  `descripcion_es`, `descripcion_en` de `CAMPS_AUDITABLES` i de les
  sentències `INSERT`/`UPDATE` a `create()`/`update()`.

## PASO 3 — Admin

- **`public/admin/index.html`, `public/admin/evento.html`**: eliminats els
  blocs `.camps-traduccio` (3 columnes CA/ES/EN) i els botons de cadenat
  `.btn-bloqueig-traduccio`. Ara només hi ha un únic camp "Nom" i un únic
  camp "Descripció".
- **`public/js/admin.js`**: eliminades `inicialitzarBloquejosTraduccio()`,
  `campTraduccioBloquejat()`, `configurarTraduccioNom()` i les icones de
  cadenat associades. Eliminades totes les referències a
  `nombre_es`/`nombre_en`/`descripcion_es`/`descripcion_en` tant al
  formulari de creació com al d'edició (lectura del backend i cos de la
  petició `POST`/`PUT`). Això resol també, com a efecte derivat, l'antic
  hallazgo de "crida síncrona sense timeout a l'API externa de traducció al
  camí d'escriptura de crear/editar un esdeveniment": simplement ja no hi
  ha cap crida a fer.
- **`public/js/admin-historial.js`**: eliminades les etiquetes de
  `nombre_es`/`nombre_en`/`descripcion_es`/`descripcion_en` de
  `ETIQUETES_CAMP` (columnes que ja no existeixen).
- **`public/css/admin.css`**: eliminades les regles `.camps-traduccio`,
  `.camp-traduccio` i `.btn-bloqueig-traduccio` (i els seus comentaris
  associats, actualitzats perquè no facin referència a classes eliminades).

## PASO 4 — Esquema

A `config/schema.sql` s'han eliminat les línies:
```sql
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS nombre_es TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS nombre_en TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS descripcion_es TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS descripcion_en TEXT;
```

**IMPORTANT (com amb la tanda de facturació)**: `schema.sql` només fa
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, mai
`DROP COLUMN` — així que aquest canvi **NO neteja les columnes existents a
la Supabase de producció** per si sol. Cal executar-ho a mà:

```sql
ALTER TABLE eventos DROP COLUMN IF EXISTS nombre_es;
ALTER TABLE eventos DROP COLUMN IF EXISTS nombre_en;
ALTER TABLE eventos DROP COLUMN IF EXISTS descripcion_es;
ALTER TABLE eventos DROP COLUMN IF EXISTS descripcion_en;
```

## VERIFICACIÓ

1. **Checkout en català, sense selector d'idioma**: servidor arrencat en
   local (`node --env-file=.env.local server.js`) contra Postgres local.
   `GET /` serveix l'HTML sense cap referència a `i18n`/`data-i18n`
   (comprovat amb `curl` + `grep`).
2. **Crear/editar esdeveniment sense API externa**: `POST
   /api/admin/traduir-nom` respon `404` (ruta eliminada). El formulari
   d'admin ja no té camps ES/EN ni crida cap endpoint de traducció.
3. **`GET /api/evento/actual` sense `?lang=`**: provat amb i sense
   `?lang=es` — comportament idèntic, mai retorna camps `_es`/`_en`
   (`{"disponible":false,"motiu":"no_hi_ha_event_actiu"}` en ambdós casos,
   ja que no hi havia cap esdeveniment creat en aquest entorn de prova).
4. **`schema.sql` des de zero**: recreat el contenidor `db-test` (volum
   Docker esborrat i tornat a crear), aplicat `aplicarSchema()` de nou.
   `\d eventos` confirma que **no** existeixen `nombre_es`, `nombre_en`,
   `descripcion_es` ni `descripcion_en`.
5. **`npm test`**: **41/41 tests passen** (0 fails), tant abans com després
   de recrear `db-test` des de zero amb l'schema net.

## Notes

- `public/mis-datos.html`/`public/js/mis-datos.js` no s'han tocat: ja eren
  només-català per decisió pròpia documentada a `CLAUDE.md`, no depenien
  de `i18n.js`.
- `nombre_invitado`/`cargo_invitado` (columnes marcades OBSOLETO a
  `schema.sql`, no relacionades amb idiomes sinó amb la migració de
  convidats) no s'han tocat: fora d'abast d'aquesta tanda.
- `_temp_repaso_proyecto_junior.md` no existia ja al repo en començar
  aquesta tanda (probablement esborrat per la tanda paral·lela); no ha
  calgut consultar-lo.
