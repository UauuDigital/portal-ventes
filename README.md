# Portal de venda d'entrades — Espai Econòmic

Portal standalone per a la venda d'entrades online als esdeveniments mensuals d'Espai Econòmic (UAUU Weddings & Events). Subdomini previst: `espaieconomic.uauu.cat`. Sense integració amb el CRM ni el dashboard existents.

## Què fa

- El client compra una entrada (per persona) a l'esdeveniment actiu i paga amb Stripe Checkout (hosted).
- L'aforament només es descompta quan el webhook `checkout.session.completed` confirma el pagament.
- La sessió de checkout expira als 30 minuts (configurable, mínim imposat per Stripe); l'esdeveniment `checkout.session.expired` allibera la reserva temporal.
- La compra es tanca automàticament un cop superada la `fecha_limite_compra` de l'esdeveniment, encara que quedin places.
- Sense QR, sense comptes d'usuari, sense reemborsaments automatitzats (es gestionen manualment des del Dashboard de Stripe), sense integració amb CRM.

## Stack

- Backend: Node.js + Express (requereix Node ≥ 22.5)
- Base de dades: PostgreSQL a Supabase, via `pg` (node-postgres)
- Frontend: HTML/CSS/JS vanilla
- Pagaments: Stripe Checkout (mode test)
- Desplegament previst: Plesk / Servàtica (Git push → Pull → restart Node.js), mateix patró que altres eines internes

## Estructura

```
config/       Connexió a la BD (Supabase/Postgres via pg) i schema SQL
models/       Evento i Compra (accés a dades, async/await)
controllers/  Lògica de negoci: esdeveniment actiu, checkout, webhook, admin
routes/       Rutes Express (públiques, webhook i admin)
middleware/   Rate limiting i autenticació del panell d'admin
utils/        Cookie de sessió signada, generació de CSV i asyncHandler
public/       Landing + checkout + panell d'admin (HTML/CSS/JS vanilla)
scripts/      Script de seed per crear un esdeveniment de prova
```

## Posada en marxa

```bash
npm install
cp .env.example .env      # omple les claus de Stripe (mode test), DATABASE_URL de Supabase i credencials
npm run seed               # crea un esdeveniment de prova per poder provar el flux
npm run dev                 # arrenca amb autoreload (node --watch)
```

`DATABASE_URL` és la connection string de Postgres del teu projecte Supabase (Dashboard → botó "Connect" → Connection string). El schema (`eventos`, `compras`) es crea automàticament en arrencar si no existeix.

Per provar els webhooks en local amb l'Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```

Copia el `whsec_...` que et dona la CLI a `STRIPE_WEBHOOK_SECRET` del `.env`.

## Panell d'administració

Accessible a `/admin/login.html` amb les credencials `ADMIN_USER`/`ADMIN_PASS` de l'`.env` (cal també definir `SESSION_SECRET`, una cadena llarga i aleatòria, per signar la cookie de sessió). Permet:

- Crear i editar esdeveniments, i "tancar-los" (equivalent a esborrar-los: deixen d'acceptar compres però l'històric es manté).
- Veure el llistat de compres de cada esdeveniment i cancel·lar-ne manualment.
- Exportar les compres d'un esdeveniment a CSV.

La sessió és una cookie signada amb HMAC-SHA256 (`utils/sessionCookie.js`), sense estat al servidor ni dependències noves.

## Model de dades

**Evento**: `id`, `nombre`, `fecha`, `descripcion`, `precio`, `aforo_total`, `fecha_limite_compra`, `estado` (abierto/cerrado), `created_at`.

**Compra**: `id`, `evento_id`, `nombre_comprador`, `email`, `telefono`, `cantidad`, `importe_total`, `quiere_factura`, `nif`, `nombre_fiscal`, `direccion_fiscal`, `stripe_checkout_session_id`, `estado_pago` (pendiente/pagado/cancelado/reembolsado), `created_at`.

`precio` i `importe_total` es guarden en **cèntims** (enters), perquè encaixen directament amb `unit_amount` de l'API de Stripe. Ex: 35,00 € → `3500`.

L'aforament disponible **no** es guarda com a camp: es calcula a l'instant (`aforo_total - places ocupades per compres pendents o pagades`), evitant condicions de cursa a l'hora de descomptar-lo.

## Notes de disseny

Fusió de dos referents:

- **Estructura BrightNest**: targeta flotant centrada, esquinas molt arrodonides, ombra suau, sobre fons gris neutre. Dues columnes dins la targeta.
- **Identitat visual UAUU** (referència: [`catalegs-web`](https://github.com/UauuDigital/catalegs-web), `css/styles.css`): tipografia `Ogg` (serif, titulars grans) + `Inter` (sans, body/etiquetes/botons, sovint en majúscules amb letter-spacing ampli), paleta `#221F1E` (fosc) / `#F2EFEE` (clar) sense gradients, botons i pills amb `border-radius: 100px`, imatges amb `border-radius: 16px`, to editorial i minimalista.

Per això el costat "de color" de la targeta és ara fons fosc pla (`#221F1E`) en lloc del gradient càlid original de BrightNest, i el botó principal és una pill (radi total) en lloc d'un rectangle arrodonit.

**Tipografia Ogg**: és una llicència pròpia de UAUU, no es pot descarregar públicament. El CSS ja declara el `@font-face` apuntant a `public/fonts/Ogg-Medium.otf`/`.ttf` — copia aquests fitxers des del repositori `catalegs-web` (carpeta `fonts/OGG MEDIUM/`) a `public/fonts/` perquè es vegi la tipografia final. Sense els fitxers, cau automàticament a Georgia (serif) i tot segueix funcionant. `Inter` es carrega des de Google Fonts (és de codi obert, no cal llicència).

**Decisió pendent #3 del briefing**: quin costat porta la info de l'esdeveniment i quin el formulari. Per defecte aquí: fosc = info de l'esdeveniment (esquerra), clar = formulari (dreta). Per intercanviar-ho, canvia l'atribut `data-layout="info-left"` a `"info-right"` a `<main class="card">` a `public/index.html` (i a `success.html`/`cancel.html` si es vol mantenir coherència visual). No cal tocar cap altre fitxer.

## Control de versions

S'ha inicialitzat el repositori amb `git init` però **sense cap commit**: els fitxers estan preparats i sense stagejar perquè puguis revisar-los amb `git status` / `git diff` i fer tu mateix el primer commit quan hi estiguis d'acord. No hi ha cap remote configurat.

## Pendent (fora d'abast d'aquesta primera entrega)

- Enviament de l'email de confirmació de compra.
- Textos legals definitius (avís legal, privacitat, cookies, condicions de venda) — `public/avis-legal.html`, `public/privacitat.html`, `public/cookies.html` i `public/condicions.html` són només placeholders enllaçats des del peu de la landing. Pendents de validar amb assessoria, especialment el punt del dret de desistiment (art. 103.l TRLGDCU) i l'esment a la política de cookies/privacitat de la càrrega de Google Fonts (única petició a tercers del portal).
- Política de cancel·lació/reemborsament — criteri encara no fixat.
- Fitxers reals de la tipografia Ogg a `public/fonts/`.

Aquestes decisions no s'han assumit ni donat per fetes; queden documentades tal com constaven al briefing original.

## Seguretat

- Mai s'emmagatzemen dades de targeta (les gestiona Stripe).
- La signatura del webhook de Stripe es verifica sempre (`STRIPE_WEBHOOK_SECRET`), amb el body en brut.
- Rate limiting a l'endpoint de creació de Checkout Session.
- Validació d'inputs del formulari: email (format), telèfon (format, si s'indica), quantitat (enter positiu), NIF/NIE/CIF (format, si es demana factura — sense dígit de control), i acceptació de condicions obligatòria. Els camps es sanegen (trim, email/NIF normalitzats) abans de desar-los.
