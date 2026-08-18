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

## Notes de domini
- `eventos.fecha` és sempre un datetime complet (no hi ha hora fixa hardcoded): tota pantalla que mostri l'hora de l'esdeveniment l'ha de llegir d'aquest camp, mai reescriure-la a mà.
- `eventos.nombre_invitado` / `cargo_invitado`: camps informatius que introdueix l'admin, no responen a res que ompli el comprador.
- Facturació ja implementada al formulari de compra (`quiere_factura`, `nif`, `nombre_fiscal`, `direccion_fiscal`).
