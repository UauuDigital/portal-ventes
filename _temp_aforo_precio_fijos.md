# Aforament i preu fixos per codi (50 places, 70,00 €)

## Què s'ha fet

**Nou mòdul `utils/eventoConfig.js`** amb les dues constants (mateix patró
que `utils/checkoutConfig.js`):
```js
const AFORAMENT_FIX = 50;
const PREU_FIX_CENTIMS = 7000; // 70,00 €
```

**`controllers/adminController.js`**:
- Eliminada la validació de `precio`/`aforo_total` de `validarEvento` (ja
  no són camps que acceptem del client).
- `crearEvento`: sempre desa `precio: PREU_FIX_CENTIMS`, `aforo_total:
  AFORAMENT_FIX`, ignorant qualsevol valor rebut al body.
- `actualitzarEvento`: els força **incondicionalment** a cada edició
  (`canvis.precio = PREU_FIX_CENTIMS; canvis.aforo_total =
  AFORAMENT_FIX;`), no només quan arriben al body — així queda garantit
  encara que algun client vell (o una petició manual) intenti enviar-los.

**`models/Evento.js` i `models/Compra.js`: sense tocar.** El model segueix
sent genèric (accepta qualsevol `precio`/`aforo_total` que li passin) — la
restricció viu només a la capa HTTP de l'admin, tal com demanava l'encàrrec.
La lògica de sobrevenda (`Compra.js`) segueix llegint `evento.aforo_total`
igual que sempre, sense cap canvi de comportament.

**Admin — `public/admin/index.html`** (formulari de crear): eliminats els
inputs de "Preu (€)" i "Aforament total"; substituïts per un text
informatiu fix: *"Preu i aforament fixos per a tots els esdeveniments:
70,00 € i 50 places, no editables."*

**Admin — `public/admin/evento.html`** (formulari d'editar): mateixos dos
inputs eliminats; substituïts per un `<p id="dades-fixes-evento">` que
`admin.js` omple dinàmicament amb els valors reals de l'esdeveniment carregat
(`Preu: 70.00 € · Aforament: 50 places (fixos, no editables des d'aquí).`) —
dinàmic i no hardcoded perquè, fins que Marc executi la migració a
producció, un esdeveniment antic hi podria mostrar encara el seu valor previ.

**`public/js/admin.js`**:
- `carregarEvento()`: ja no omple els inputs `#precio`/`#aforo_total`
  (eliminats); omple el nou paràgraf informatiu.
- Als dos `submit` (crear i editar): ja no s'envien `precio`/`aforo_total`
  al body de la petició (el backend els ignoraria igualment, però així no
  queden crides a `getElementById('precio')` sobre un element que ja no
  existeix).
- La resta de llocs que ja mostraven aforament/preu en només lectura
  (taula d'esdeveniments a `index.html`, tooltip del calendari) **no s'han
  tocat** — ja eren de només lectura i llegeixen `ev.aforo_total`/`ev.precio`
  directament de la resposta de l'API, així que continuen mostrant el valor
  real sense cap canvi.

## Verificació

1. **Crear evento con aforo/precio distintos (100 plazas, 50€) → se guarda
   50/70€.** Provat via `POST /api/admin/eventos` amb `"precio":5000,
   "aforo_total":100` a l'entorn local: la resposta retorna
   `"precio":7000,"aforo_total":50`. Provat també amb `PUT` (editar) enviant
   `precio:1, aforo_total:999` → mateix resultat forçat. ✅
2. **L'admin mostra l'aforament (50) en només lectura, sense cap input per
   canviar-lo.** Confirmat visualment: a `evento.html` (detall/edició) i al
   modal de crear a `index.html`, ambdós mostren el text fix i no hi ha cap
   `<input>` de preu/aforament. ✅
3. **El checkout públic segueix mostrant "70,00 €" amb normalitat.**
   Confirmat visualment a `/` (pàgina principal): "PREU DEL MENÚ / 70.00 €".
   ✅
4. **La lògica de sobrevenda segueix igual.** `tests/aforo.test.js` no
   s'ha tocat i crea els seus esdeveniments de prova directament via
   `Evento.create()` (capa de model, no passa per l'admin), així que no li
   afecta aquest canvi — segueix en verd. ✅
5. **`npm test` complet: 50/50 tests passant.** ✅

Dades de test creades i esborrades després de la verificació: esdeveniment
d'ID 22 ("Prova aforament fix") a la BD local (`portal-ventes-db-1`, port
55432) — no queda cap resta.

## UPDATE SQL per a producció (Supabase) — NO executat aquí

Marc l'executa directament a Supabase. Unitats confirmades: `precio` en
cèntims (7000 = 70,00 €), sense clàusula `WHERE` perquè s'ha d'aplicar a
**tots** els esdeveniments existents, sense excepció:

```sql
UPDATE eventos SET precio = 7000, aforo_total = 50;
```
