# Panell d'administració (CRUD esdeveniments + compres)

## Context

El portal actual només exposa un flux públic de compra (`routes/publicRoutes.js`): consultar l'esdeveniment actiu i crear una sessió de Stripe Checkout. La creació d'esdeveniments només es pot fer avui via `scripts/seed.js` o directament a la base de dades. El README ja documentava això com a pendent:

> Panell d'administració (crear/editar esdeveniment, llistat de compres, exportació CSV, login).

Aquest document especifica aquest panell.

## Abast

- Login d'un únic usuari administrador (usuari + contrasenya).
- CRUD d'esdeveniments: crear, llistar (tots, no només l'actiu), editar, "esborrar" (esborrat tou).
- Llistat de compres per esdeveniment, amb possibilitat de cancel·lar-ne una manualment.
- Exportació CSV de les compres d'un esdeveniment.

Fora d'abast (no es toca en aquesta entrega): enviament d'emails, exportació més enllà de CSV, gestió de reemborsaments via Stripe (es continua fent manualment des del Dashboard de Stripe), multi-usuari/rols, recuperació de contrasenya.

## Autenticació

Sense dependències noves. El fitxer `.env.example` ja reserva `ADMIN_USER` / `ADMIN_PASS` per a "el futur panell d'administració" — s'utilitzen tal qual (contrasenya en pla dins l'`.env`, mai committejada, mateix nivell de confiança que la resta de secrets del projecte com `STRIPE_SECRET_KEY`).

- `POST /admin/login` (body `{ usuari, contrasenya }`): compara amb `ADMIN_USER`/`ADMIN_PASS` fent servir `crypto.timingSafeEqual` (evita timing attacks; cal igualar longituds abans de comparar). Si coincideix, genera una cookie de sessió signada:
  - Payload: `{ usuari, exp }` (expiració 8 hores) codificat en base64url.
  - Signatura: HMAC-SHA256 amb `SESSION_SECRET` (nova variable d'entorn), també en base64url.
  - Cookie: `admin_session=<payload>.<signatura>`, `HttpOnly`, `SameSite=Strict`, `Secure` quan `NODE_ENV=production`.
  - Sense estat al servidor: cada petició es revalida recalculant la signatura i comprovant `exp`.
- `POST /admin/logout`: esborra la cookie (`res.clearCookie`).
- `middleware/authMiddleware.js`: exporta una funció `requireAuth(req, res, next)` que valida la cookie; si falta o no és vàlida, respon `401` (rutes `/api/admin/*`) o redirigeix a `/admin/login.html` (rutes de pàgina `/admin/*.html` servides com a estàtiques — cal interceptar-les explícitament, veure "Rutes" més avall).

Nova variable d'entorn: `SESSION_SECRET` (string aleatòria llarga), afegida a `.env.example` amb comentari.

## Model de dades

Cap canvi a `config/schema.sql`. "Esborrar" un esdeveniment reutilitza el camp `estado` existent (`abierto`/`cerrado`): posar-lo a `cerrado` el treu de `Evento.getActivo()` i, per tant, ja no admet compres noves. No s'introdueix cap estat nou ni columna `deleted_at`.

Compres: es reutilitza `estado_pago` existent (`pendiente/pagado/cancelado/reembolsado`); cancel·lar manualment una compra crida `Compra.marcarCancelado(id)`, ja existent.

## Backend

**Nous fitxers:**

- `middleware/authMiddleware.js` — `requireAuth`, i helpers `crearCookieSessio`/`verificarCookieSessio` (o en un mòdul propi `utils/sessionCookie.js` si guanya en claredat).
- `controllers/authController.js` — `login`, `logout`.
- `controllers/adminController.js` — `llistarEventos`, `crearEvento`, `actualitzarEvento` (inclou l'"esborrat" com a `estado=cerrado`), `llistarCompresEvento`, `cancelarCompra`, `exportarComprasCsv`.
- `routes/adminRoutes.js` — munta totes les rutes `/admin/login`, `/admin/logout`, `/api/admin/*` protegides amb `requireAuth` (excepte login).

**Reutilització:** `models/Evento.js` (`create`, `update`, `getById`) i `models/Compra.js` (`listByEvento`, `marcarCancelado`) ja tenen tot el necessari; s'hi afegeix només `Evento.listAll()` (`SELECT * FROM eventos ORDER BY fecha DESC`), que no existeix encara.

**Endpoints:**

| Mètode | Ruta | Descripció |
|---|---|---|
| POST | `/admin/login` | Login, retorna cookie de sessió |
| POST | `/admin/logout` | Logout |
| GET | `/api/admin/eventos` | Llistat complet d'esdeveniments |
| POST | `/api/admin/eventos` | Crear esdeveniment |
| PUT | `/api/admin/eventos/:id` | Editar esdeveniment (inclou tancar-lo, `estado: 'cerrado'`) |
| GET | `/api/admin/eventos/:id/compras` | Llistat de compres de l'esdeveniment |
| POST | `/api/admin/compras/:id/cancelar` | Cancel·la manualment una compra |
| GET | `/api/admin/eventos/:id/compras/export.csv` | Exportació CSV de les compres |

Validació dels camps d'esdeveniment (nom, data, preu > 0, aforament > 0, data límit anterior a la data de l'esdeveniment) reutilitzant l'estil de validació ja existent al flux de compra pública (sanejament + missatges d'error en català).

**CSV**: generat a mà (sense llibreria), amb capçalera i escapament bàsic (cometes dobles si el camp conté `,`, `"` o salt de línia). Columnes: nom comprador, email, telèfon, quantitat, import total (en €, convertit des de cèntims), factura (sí/no), NIF, nom fiscal, adreça fiscal, estat de pagament, data de compra.

## Frontend

Nous fitxers estàtics a `public/admin/`, servits per `express.static` com la resta del `public/` (protegits per `requireAuth` a nivell de ruta explícita abans del `express.static`, ja que aquest middleware no distingeix per contingut):

- `public/admin/login.html` — formulari usuari/contrasenya.
- `public/admin/index.html` — llistat d'esdeveniments (taula: nom, data, estat, aforament ocupat/total) + formulari de creació/edició (mateix formulari, mode creació si no hi ha `id`).
- `public/admin/evento.html` — detall d'un esdeveniment: dades editables + llistat de compres (taula) + botó "Cancel·lar" per compra pendent/pagada + botó "Exportar CSV".
- `public/js/admin.js` — lògica compartida (fetch a l'API, gestió de formularis, redirecció a login si `401`).

Estil visual: es reutilitza `public/css/style.css` (paleta UAUU ja definida) més estils puntuals per a taules, sense necessitat d'un sistema de disseny nou.

## Gestió d'errors

- Credencials invàlides al login: `401` amb missatge genèric ("Usuari o contrasenya incorrectes") — no es distingeix si falla l'usuari o la contrasenya.
- Cookie de sessió absent/invàlida/expirada a qualsevol ruta `/api/admin/*`: `401 { error: 'no_autenticat' }`; el JS de `admin.js` redirigeix a `login.html`.
- Validació d'esdeveniment fallida: `400` amb el primer error trobat, en català, mateix format que ja fa servir el checkout públic.
- Cancel·lar una compra ja `cancelado` o `reembolsado`: `409` (operació no aplicable).

## Testing

- Tests manuals via `npm run dev` + Claude in Chrome (com ja s'ha fet amb el modal legal): login correcte/incorrecte, crear esdeveniment, editar-lo, "esborrar-lo" (comprovar que desapareix com a actiu al portal públic), llistar compres d'un esdeveniment amb dades de prova, cancel·lar-ne una, exportar CSV i obrir el fitxer.
- No s'introdueix cap framework de test nou (el projecte no en té cap actualment); si en el futur se n'afegeix un, aquest panell hauria de ser el primer candidat a cobrir amb tests d'integració sobre l'API (`/api/admin/*`).
