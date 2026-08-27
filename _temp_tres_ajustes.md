# Tres ajustes: botó "Tots els esdeveniments", "Preu del menú" i stepper de cantidad

## AJUSTE 1 — Reubicar "Tots els esdeveniments"

**Decisión de posición (no evidente — necesita el visto bueno):**
El botó ha sortit completament del panell fosc (`.panel-color`). Ara viu com
un enllaç discret per sobre de tota la targeta (`.card`), abans del `<main>`,
amb el mateix ample màxim (920px) i el mateix padding lateral que el panell
(40px escriptori / 24px mòbil), de manera que el seu marge esquerre queda
alineat amb el marge del títol però mai sobre la mateixa franja horitzontal.

Motiu: amb noms d'esdeveniment llargs (cas real provat: "Sopar de gala de fi
d'any amb ponents internacionals convidats especialment per Espai Econòmic"),
l'`<h1>` ocupa 5-6 línies i arriba fins a la cantonada superior dreta del
panell — exactament on vivia el botó abans (absolut, `top:0/right:0`). Cap
ajust d'ancoratge dins el panell evita el xoc quan el títol és prou llarg;
treure'l del panell és l'única solució que ho garanteix "en cap amplada de
pantalla raonable", tal com demanava la tasca.

Captura (cas pitjor: nom d'esdeveniment llarg, mòbil ~600px d'ample):
`_temp_captura_tornar_selector.jpg` (adjuntada al xat).

Fitxers tocats: `public/index.html` (moc del botó), `public/css/layout.css`
(substitueix el posicionament absolut per un bloc normal per sobre de la
targeta; s'ha eliminat el `position:relative` de `.evento-info-titol` i el
`@media` que ja no calen).

## AJUSTE 2 — "Preu" → "Preu del menú"

Canvi de text únic a `public/index.html`: `<span class="eyebrow">Preu</span>`
→ `<span class="eyebrow">Preu del menú</span>`. Sense tocar mida, posició ni
l'estil `.eyebrow` (les majúscules ja venen del `text-transform: uppercase`
existent).

## AJUSTE 3 — Stepper de cantidad (−/+)

- L'`<input type="number" id="cantidad">` s'ha convertit en
  `<input type="hidden" id="cantidad">` (mateix `id`/`name`, mateix valor
  enviat al body de la compra — cap canvi al JS que ho llegeix).
- S'hi ha afegit un stepper visual: botó "−" (`<button type="button">`,
  `aria-label="Reduir nombre de places"`), un `<span>` amb el número
  (`aria-live="polite"` perquè lectors de pantalla anunciïn el canvi), i
  botó "+" (`aria-label="Augmentar nombre de places"`), agrupats amb
  `role="group" aria-labelledby="cantidad-label"`.
- Colors: `--dark` / `--dark-hover` (els mateixos del `.btn-primary` /
  "Pagar i reservar plaça"), no l'ambre de la imatge de referència.
- Mínim 1, sense màxim al stepper (l'aforament real es valida al backend en
  enviar, tal com demanava la tasca — no s'ha duplicat aquesta lògica).
- El botó "−" es desactiva (`disabled`, opacitat reduïda) en arribar a 1.
- Cada clic canvia el valor de `#cantidad` i en dispara l'event `input`
  natiu (`input.dispatchEvent(new Event('input'))`): el listener que ja
  existia (`actualitzarAcompanyants` + `actualitzarPreu`) s'executa igual
  que abans en canviar l'input a mà — no s'ha duplicat cap lògica de
  recàlcul, només s'ha afegit `canviarCantidad(delta)` i
  `actualitzarEstatStepperCantidad()` a `public/js/checkout.js`.

Fitxers tocats: `public/index.html`, `public/js/checkout.js`,
`public/css/forms.css` (noves classes `.stepper-label`, `.stepper-cantidad`,
`.stepper-btn`, `.stepper-valor`).

Cache-busting: bumped `layout.css` (v20→v21), `forms.css` (v24→v25),
`style.css` (v15→v16) i `checkout.js` (v30→v31) als `<link>`/`<script>` de
`index.html`.

## VERIFICACIÓ

1. **Dos esdeveniments actius simultanis** (creats temporalment a la BD
   local, esborrats després de la prova): "Tots els esdeveniments" i el
   títol no es xoquen mai, ni a escriptori ni a mòbil (~390-600px). Captura
   adjuntada.
2. **Visual**: "PREU DEL MENÚ" es mostra correctament a la fitxa, mateix
   estil que abans.
3. **Stepper**: clic a "+" incrementa la cantidad, actualitza el preu visible
   (65,00€ → 130,00€ amb cantidad 2) i desplega l'acordió d'acompanyants en
   viu; clic a "−" torna a 1, amaga l'acordió i el preu torna a 65,00€, i el
   botó "−" queda desactivat en arribar a 1. Colors = `.btn-primary` (fosc),
   no l'ambre de referència.
4. **Compra real amb el stepper (només clics per a la cantidad)**: provada
   dues vegades sobre Postgres local + Stripe test mode. En totes dues,
   cantidad=2 (via clic a "+") es va reflectir correctament a l'Stripe
   Checkout Session (130,00€ / 50,00€ segons l'esdeveniment, "Cantidad 2, X
   € unidad") i a la BD (`compras.cantidad = 2`, fila d'acompanyant creada
   correctament a `compra_acompanyants`). La segona prova es va completar
   sencera amb targeta de test (4242 4242 4242 4242) fins a la pàgina
   "Gràcies per la teva compra!".
   **Nota**: `estado_pago` va quedar "pendiente" perquè l'entorn local no
   té el listener de webhooks de Stripe (`stripe listen`) aixecat i
   `STRIPE_WEBHOOK_SECRET` a `.env.local` sembla un valor de marcador
   (`acct_...`, no un `whsec_...` real) — és una limitació de l'entorn de
   dev, no relacionada amb aquest canvi. El processament del webhook
   (`checkout.session.completed` → marcar la compra com a pagada) ja està
   cobert i verificat pels tests automàtics existents (`webhook.test.js`,
   tots en verd).
   Dades de test creades i esborrades després de la verificació: esdeveniments
   d'ID 18-21 i compres d'ID 20-21 a la BD local (`portal-ventes-db-1`,
   port 55432) — no queda cap resta.
5. **`npm test`**: 50/50 tests passant (calia Docker per a `portal-ventes-db-test-1`,
   ja el tenia aixecat el projecte).
