# Sustituir validación nativa del navegador por avisos propios

## Inventario de formularios (completo, revisado por grep antes de tocar nada)

| Archivo | Formulario | Campos `required`/`type="email"` |
|---|---|---|
| `public/index.html` | `#form-compra` (checkout público) | `nombre_comprador` (required), `email` (required, type=email), `accepta_condicions` (checkbox required) |
| `public/admin/login.html` | `#form-login` | `usuari` (required), `contrasenya` (required) |
| `public/admin/index.html` | `#form-evento` (crear evento) | `nombre` (required), `fecha` (required, campo readonly custom de calendari) |
| `public/admin/evento.html` | `#form-evento-editar` (editar evento) | `nombre` (required), `fecha` (required, `type="datetime-local"`) |

**No tocados, con motivo:**
- El acordeón d'acompanyants (`checkout.js`) — ja tenia validació pròpia d'una tanda anterior (per als motius exposats a l'encàrrec: només la secció oberta té els inputs al DOM). No l'he tocat, només l'he fet servir de referència d'estil (`:invalid` + classe `--validat` que activa la vora vermella).
- `#email-prova-destinatari` (evento.html) — `type="email"` però **no** `required`, i el seu botó és `type="button"` (no dispara mai validació nativa en fer-hi clic, no hi ha submissió de formulari implicada). No calia tocar-lo.
- Camp `invitados` (nom/càrrec) — no porten `required` a l'HTML; ja es validen amb JS propi ("Cal almenys un convidat amb nom.") en ambdós formularis d'esdeveniment. No tocat.

## Disseny aplicat (mateix a tots 4 formularis)

1. `novalidate` afegit a cada `<form>`.
2. Una funció compartida `validarCampsNatius(form, errorEl)` (duplicada a `checkout.js` i `admin.js` — mateix patró de duplicació que ja existia al projecte per a `escapeHtml`/`formatEuros` entre aquests dos fitxers, no hi ha sistema de mòduls):
   - Afegeix la classe `.form-validat` al formulari.
   - Si `form.checkValidity()` és `false`: busca `form.querySelector(':invalid')`, li fa `.focus()`, i escriu un missatge en català al bloc d'error existent de cada formulari (`#error-missatge`, `#error-login`, `#error-evento`, `#error-evento-editar` — reaprofitant el mateix patró `.form-error`/`data.detalls.join(', ')` que ja feia servir el projecte, no n'he inventat cap de nou).
   - Missatges: "Aquest camp és obligatori." (`valueMissing`), "Introdueix un email vàlid." (`typeMismatch`), "Has d'acceptar-ho per continuar." (checkbox required desmarcat).
3. CSS compartida a `forms.css` (carregada arreu via `style.css`): `.form-validat input:invalid, select:invalid, textarea:invalid { border-color: var(--error); }` — mateix patró exacte que ja existia només per a l'acordió d'acompanyants (`.acompanyants-acordio--validat`), generalitzat aquí. Els checkboxes en queden exclosos (com ja fa el `:focus` global): la vora no s'hi veu de forma fiable entre navegadors.
4. Neteja de pas: `#error-login` i `#error-evento` tenien el mateix estil dut a mà per `style=""` — els he passat a la classe `.form-error` compartida, en lloc de deixar dos patrons visuals idèntics escrits de dues maneres.

## Verificació

1. **Cada formulari, enviament amb camps buits/invàlids → avís propi, NO el globus natiu.** Confirmat visualment als 4 formularis (captures de login i checkout adjuntades al xat; crear/editar esdeveniment també provats, mateix comportament). Cap globus natiu del navegador en cap dels 4 casos.
2. **Omplert correcte → funciona igual que abans:**
   - Login: entra correctament amb `admin-local`/contrasenya de prova.
   - Crear esdeveniment: es crea i apareix a la taula/historial.
   - Editar esdeveniment: es desa i apareix "modificat" a l'historial.
   - Checkout: amb cantidad=2 (comprador + 1 acompanyant), arriba correctament a Stripe Checkout (redirecció confirmada).
3. **L'acordeón d'acompanyants segueix intacte.** Provat explícitament: enviar amb el comprador vàlid però l'acompanyant sense dades → **la validació pre-existent el va detectar igual que sempre** (obre la secció, la marca en vermell, mostra "Revisa les dades dels acompanyants: falta algun nom o l'email no és vàlid."). El meu check nou (`validarCampsNatius`) no interfereix perquè només la secció OBERTA té inputs al DOM en cada moment — si està tancada, `form.checkValidity()` no la veu, i el check propi dels acompanyants (que llegeix l'array JS, no el DOM) l'atrapa igualment després. Cap conflicte, cap codi tocat.
4. **`npm test`: 50/50 passant.**

## Captures (2 formularis, tal com es demanava)

- **Login** (`admin/login.html`): captura enviada al xat — tots dos camps en vermell, focus a "Usuari", "Aquest camp és obligatori." sota el botó.
- **Checkout públic** (`index.html`): captura enviada al xat — "Nom i cognoms" i "Email" en vermell, focus al primer, mateix missatge.
- (Crear/editar esdeveniment provats amb el mateix resultat, captures disponibles si calen.)

## Decisions de disseny que no estaven especificades literalment

- **Text exacte dels missatges**: "Aquest camp és obligatori.", "Introdueix un email vàlid.", "Has d'acceptar-ho per continuar." — triats seguint l'exemple donat a l'encàrrec ("Aquest camp és obligatori") i el to directe ja existent al projecte (ex. "Cal almenys un convidat amb nom.").
- **Un sol missatge general per intent, no un per camp**: en lloc de llistar tots els camps invàlids alhora, es mostra el missatge del PRIMER camp invàlid (amb focus a sobre) — mateix criteri que ja seguia el navegador natiu (un globus a la vegada) i que l'acordió d'acompanyants (un missatge general + indicador visual a cada camp).
- **Checkboxes exclosos de la vora vermella**: coherent amb com el projecte ja tracta `:focus` de checkboxes de forma diferent a la resta de camps (`input[type="checkbox"]:focus-visible` per separat a `forms.css`).
- **Neteja de `#error-login`/`#error-evento`** cap a la classe `.form-error` compartida — no canvia res visualment (mateixos valors exactes que l'inline `style=""`), només consolida dos formularis més al mateix patró en lloc de mantenir-hi un `style=""` dur a mà.
