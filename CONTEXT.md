## portal-ventes (Espai Econòmic)

**Propòsit**
Portal de venda d'entrades online per als esdeveniments mensuals d'Espai Econòmic, dins UAUU Weddings & Events. Gestiona compra d'entrades amb pagament via Stripe, panell d'administració per gestionar esdeveniments/compres, i emails de confirmació.

**Estat**
Desenvolupament (Stripe en mode test segons README). Repositori actiu amb commits recents (branca `main`).

**Stack tècnic**
- Llenguatge/framework: Node.js (≥22.5.0) + Express, monolític, frontend HTML/CSS/JS vanilla servit com a estàtics.
- Base de dades: PostgreSQL (Supabase), accés directe via `pg` (no PostgREST ni SDK JS de Supabase). RLS activat a totes les taules però no s'aprofita (accés sempre via connexió directa).
- Hosting/desplegament: Previst a Plesk / Servàtica, patró "Git push → Pull → restart Node.js" (sense Docker/PaaS). Subdomini previst: `espaieconomic.uauu.cat`.
- Gestor de paquets: npm (`package.json`, sense lockfile especificat als resultats).

**Punt d'entrada**
- Arrencada: `npm start` → `node server.js` (escolta a `process.env.PORT || 3000`).
- Desenvolupament: `npm run dev` (`node --watch server.js`).
- Altres scripts: `npm run seed`, `npm run migrar-invitados`, `npm run diag`, `npm run check-preu`.
- A l'arrencada s'auto-aplica `config/schema.sql` (`db.aplicarSchema()`).

**Interfícies que EXPOSA cap a fora**
- API pública (sense autenticació):
  - `GET /api/evento/actual`, `GET /api/evento/actius`
  - `POST /api/checkout/crear`, `POST /api/checkout/cancelar`
  - `GET /api/checkout/confirmacion/:session_id`
  - `GET /health`
- API/panell admin (autenticació per cookie de sessió `admin_session`, HMAC-SHA256, rols `admin`/`viewer`):
  - `POST /admin/login`, `POST /admin/logout`, `GET /api/admin/me`
  - `GET /api/admin/eventos`, `GET /api/admin/eventos/:id`, `GET /api/admin/eventos/:id/compras`, `GET /api/admin/historial` (admin+viewer)
  - `POST/PUT/DELETE /api/admin/eventos[...]`, `POST /api/admin/compras/:id/cancelar`, `POST /api/admin/eventos/:id/email-prova` (només admin)
  - `GET /api/admin/eventos/:id/compras/export.pdf` — exportació d'assistents en PDF (admin) — **nota: el README parla de CSV, però actualment és PDF via `pdfkit`**.
- Webhook entrant: `POST /webhook/stripe` — rep events de Stripe (`checkout.session.completed`, `checkout.session.expired`), verificat per signatura (`STRIPE_WEBHOOK_SECRET`), body cru (`express.raw`).
- No exposa cap fitxer CSV ni API pensada per ser consumida per altres sistemes UAUU (README indica explícitament "Sense integració amb el CRM ni el dashboard existents").

**Dependències EXTERNES que aquest projecte CONSUMEIX**
- Altres recursos UAUU:
  - Portal de suport/tiquets extern: enllaç a `https://tiquets.uauu.cat/?repo=uauudigital-portal-ventes`, només a l'àrea admin (`public/admin/index.html`, `public/admin/evento.html`), no a la pàgina pública de compra.
  - Repositori de disseny `catalegs-web` (github.com/UauuDigital/catalegs-web), referenciat per a identitat visual (tipografia Ogg, estils).
- Serveis de tercers:
  - **Stripe** (Checkout Sessions + Webhooks) — pagaments.
  - **Resend** (`resend` SDK) — enviament d'emails transaccionals (confirmació de compra, email de prova des de l'admin).
  - **Supabase** — allotjament de la base de dades PostgreSQL (connexió directa via `DATABASE_URL`, no via API Supabase).
- No s'ha detectat consum de cap altre repo/servei UAUU addicional al codi.

**Dades compartides**
- Base de dades pròpia a Supabase (no s'ha determinat si es comparteix instància/projecte Supabase amb altres projectes UAUU — "No determinat").
- Mateix compte/compte Stripe: "No determinat" si és compartit amb altres projectes UAUU.
- Adreça de contacte `anna@uauu.cat` reutilitzada a plantilles d'email i pàgines legals.
- Titular legal de les pàgines legals: Carol Gastronomia, SL (NIF B66216946) — no una entitat "UAUU" directa.

**Variables d'entorn rellevants per integració**
- `BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`

**Pendents/TODOs coneguts relacionats amb integració**
- README secció "Pendent": textos legals encara placeholder, política de cancel·lació/reemborsament sense fixar, tipografia Ogg pendent de copiar des de `catalegs-web`/assets compartits UAUU.
- README desactualitzat en almenys dos punts respecte al codi actual: (1) parla d'exportació CSV, quan ara és PDF (`pdfkit`); (2) l'email de confirmació que marcava com a pendent ja està implementat.
- `config/schema.sql`: columnes `nombre_invitado`/`cargo_invitado` marcades com "OBSOLETO", pendents d'eliminar.
- No hi ha integració amb el CRM ni el dashboard existents de UAUU (declarat explícitament al README com a fora d'abast).
