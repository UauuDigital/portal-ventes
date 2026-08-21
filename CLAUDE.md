# CLAUDE.md — portal-ventes (Espai Econòmic)

## Stack tècnic (decidit, no canviar sense confirmar-ho)
- Backend: Node.js + Express (monolític, sense framework de tipus Next.js).
- Base de dades: PostgreSQL (Supabase), connexió directa via `pg` (no s'usa el SDK JS de Supabase ni PostgREST).
- Esquema de BD: fitxer únic `config/schema.sql`, auto-aplicat a l'arrencada (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`). No hi ha sistema de migracions.
- Pagaments: Stripe Checkout Sessions + webhook.
- Emails transaccionals: Resend (`utils/mailer.js`).
- Frontend: HTML/CSS/JS vanilla sense build step, servit com a estàtics des de `public/`.

## Estructura
```
server.js
config/            # db.js, schema.sql
controllers/        # authController, adminController, eventoController, stripeController
models/              # Evento.js, Compra.js (SQL cru via db.prepare)
middleware/          # authMiddleware (sessió + rols), rateLimiter
routes/              # publicRoutes, adminRoutes, webhookRoutes
utils/               # asyncHandler, sessionCookie, csv, traduccio, i18n, mailer
public/              # index.html (compra), success.html, cancel.html, admin/*, js/*, css/*
```

## Autenticació i rols
- Cookie de sessió `admin_session` (HMAC-SHA256, `utils/sessionCookie.js`), payload amb `{ usuari, rol, exp }`.
- Dos rols: `admin` (accés total) i `viewer` (només lectura, per al personal d'Espai Econòmic — consulta d'esdeveniments i compres, sense poder editar/cancel·lar/exportar).
- Credencials per variables d'entorn: `ADMIN_USER`/`ADMIN_PASS` i `VIEWER_USER`/`VIEWER_PASS`.
- `middleware/authMiddleware.js`: `requireRole(...rols)` per protegir rutes segons rol.

## Decisions conegudes
- **Naming del backend en camelCase, no kebab-case:** els fitxers de `controllers/`, `middleware/`, `routes/`, `utils/` i `models/` (`adminController.js`, `authMiddleware.js`, `Evento.js`, etc.) usen camelCase/PascalCase, tot i que la regla global d'UAUU exigeix kebab-case. És una excepció deliberada: el codi ja és consistent amb aquest patró arreu i renombrar-lo trencaria imports sense cap benefici real. `public/` sí segueix kebab-case per als fitxers estàtics.
- `public/mis-datos.html` / `public/js/mis-datos.js` són intencionadament només en català, a diferència de la resta del frontend públic (que és multi-idioma via `js/i18n.js`). El motiu: l'enllaç a aquesta pàgina s'envia per email després de la compra i, ara mateix, no es guarda l'idioma triat pel comprador (`eventos`/`compras` no tenen columna de locale), de manera que no hi ha manera de saber en quin idioma renderitzar-la. Fer-la multi-idioma de debò requeriria desar l'idioma de compra a la BD i passar-lo a l'enllaç — no és un simple afegit de claus `data-i18n`. Si es vol abordar, cal fer-ho com a tasca pròpia (canvi d'esquema + backend), no com a retoc de frontend.

## Notes de domini
- `eventos.fecha` és sempre un datetime complet (no hi ha hora fixa hardcoded): tota pantalla que mostri l'hora de l'esdeveniment l'ha de llegir d'aquest camp, mai reescriure-la a mà.
- `eventos.nombre_invitado` / `cargo_invitado`: camps informatius que introdueix l'admin, no responen a res que ompli el comprador.
- Facturació ja implementada al formulari de compra (`quiere_factura`, `nif`, `nombre_fiscal`, `direccion_fiscal`).
