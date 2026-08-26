# Sustituir "entrada/entrades" por "plaça/places" en todo el texto visible

25 apariciones cambiadas en 12 archivos. Grep exhaustivo antes y después, verificado en vivo (checkout, éxito, admin, email interno, CSV).

---

## Grep inicial — todas las apariciones encontradas

Comando: `grep -rniE "entrad(a|es)" --include="*.html" --include="*.js" --include="*.sql" --include="*.md" --include="*.json" .` (excluyendo `node_modules`, `.git`).

### Cambiadas (texto visible al usuario/admin, en la app)

| Archivo:línea | Antes | Después |
|---|---|---|
| `utils/mailer.js:20` | `Confirmació de la teva entrada — {{nom_esdeveniment}}` | `Confirmació de la teva plaça — {{nom_esdeveniment}}` |
| `utils/mailer.js:29` | `<li><strong>Entrades:</strong> {{quantitat}}</li>` | `<li><strong>Places:</strong> {{quantitat}}</li>` |
| `public/index.html:6` | `<title>...Reserva la teva entrada</title>` | `...Reserva la teva plaça` |
| `public/index.html:60` | `Nombre d'entrades` | `Nombre de places` |
| `public/index.html:94` | `Pagar i reservar entrada` | `Pagar i reservar plaça` |
| `public/js/checkout.js:20` | `...la venda de entrades.` | `...la venda de places.` |
| `public/js/checkout.js:22` | `Les entrades per a aquest esdeveniment s'han esgotat.` | `Les places...` |
| `public/js/checkout.js:28` | `btn_comprar: 'Pagar i reservar entrada'` | `'Pagar i reservar plaça'` |
| `public/avis-legal.html:21` | `...venda d'entrades per a aquests esdeveniments.` | `...venda de places...` |
| `public/avis-legal.html:24` | `...compra d'entrades.` | `...compra de places.` |
| `public/cookies.html:18` | `...venda d'entrades d'aquest Portal...` | `...venda de places...` |
| `public/success.html:20` | `...confirmació de la teva entrada...` | `...de la teva plaça...` |
| `public/success.html:27` | `...modificar la teva entrada...` | `...la teva plaça...` |
| `public/js/success.js:23` | `` `${cantidad} entrada(es)` `` | `` `${cantidad} ${cantidad === 1 ? 'plaça' : 'places'}` `` (ver nota de pluralización abajo) |
| `public/admin/index.html:39` | `<th>Entrades restants</th>` | `<th>Places restants</th>` |
| `public/js/admin.js:383` | `Entrades comprades: <strong>...` | `Places comprades: <strong>...` |
| `controllers/stripeController.js:135` | `` name: `Entrada — ${evento.nombre}` `` | `` name: `Plaça — ${evento.nombre}` `` (visible en el Checkout hospedado de Stripe) |
| `public/admin/evento.html:110` | `placeholder="Confirmació de la teva entrada — ..."` | `placeholder="Confirmació de la teva plaça — ..."` |
| `models/Compra.js:55` | `` (${compra.cantidad} entrades) `` (descripció d'historial, visible a l'admin) | `` (${compra.cantidad} places) `` |
| `public/condicions.html:15` | `venda d'entrades... compra d'una entrada` | `venda de places... compra d'una plaça` |
| `public/condicions.html:21` | `el nombre d'entrades` | `el nombre de places` |
| `public/condicions.html:27` | `confirmació/entrada` | `confirmació/plaça` |
| `public/condicions.html:39` | `exhaurides les entrades disponibles` | `exhaurides les places disponibles` |
| `public/privacitat.html:21` | `compres una entrada... el nombre d'entrades sol·licitades` | `compres una plaça... el nombre de places sol·licitades` |
| `public/privacitat.html:24` | `venda de l'entrada` | `venda de la plaça` |

**Total: 25 apariciones cambiadas en 14 puntos de edición (12 archivos).**

### Excluidas — identificadores de código o significado distinto (no tocadas, justificadas)

Estas SÍ contienen "entrada"/"entrades" en el grep pero no son texto visible con el significado "billete de evento":

- **`public/js/admin-historial.js`** (todo el archivo, ~15 apariciones) y **`controllers/adminController.js:218-219`** — variable `entrada`/`entrades` significa **"entrada del historial/auditoría"** (un registro/entry en el log), no "billete". Es un significado distinto de la misma palabra catalana ("entrada" = "entry" genérico), sin relación con el dominio de venta de entradas. No se toca.
- **`tests/aforo.test.js`, `tests/webhook.test.js`, `tests/validarInvitados.test.js`** — mismo caso: `entrada`/`entrades` como nombre de variable para "registro de historial" o "entrada de un test". No renderiza nada, no es texto de dominio.
- **`utils/camposFormulario.js:75,78`** — `const entrada = respuestas...` — "entrada" como "entrada de un objeto" (concepto genérico de programación), no billete.
- **`public/js/admin.js:205,216-218,577`** — `badgeEntradesRestants` (nombre de función) y las clases CSS `entrades-restants`/`entrades-restants--*`/`entrades-restants-numero`/`entrades-restants-barra*`. Son identificadores de código — la función **no renderiza ningún texto con la palabra "entrada"**, solo un número (`${restants}`) dentro de esas clases. Cero texto visible que cambiar aquí; dejé los identificadores tal cual, tal como pedía la instrucción de no tocar nombres de variables/funciones/clases.

### Excluidas — documentación interna, no renderizada en la app (fuera del alcance "pantalla, email o CSV")

- `README.md` (líneas 1, 3, 7) — documentación del repo, no se muestra en ninguna pantalla de la aplicación.
- `package.json:5` — campo `description` de npm, no aparece en ningún sitio de la UI.
- `config/schema.sql:67` — comentario de código explicando la tabla `historial`, no es texto visible.
- `docs/superpowers/plans/2026-08-18-formulari-compra-personalitzat.md` — documento de planificación histórico, no forma parte de la app.

Ninguna de estas encajaba en "lo que lee el usuario o el admin en pantalla, email o CSV" que delimitaba la tarea, así que no las toqué. Si quieres que también se actualicen por coherencia documental, dímelo aparte — no es lo mismo que el texto de producto.

---

## Caso que requirió una decisión (no puramente mecánico)

**`public/js/success.js:23`** — el original decía `` `${cantidad} entrada(es)` ``, un truco de texto fijo que muestra literalmente "entrada(es)" en pantalla sea cual sea el número (nunca fue pluralización real, es solo una anotación visual para que el lector humano ignore el "(es)" si es 1). Ese truco **no se puede transportar tal cual a "plaça"**: "plaça" no pluraliza añadiendo un sufijo a secas — pierde la cedilla (plaça → **places**, no "plaçaes"). Escribir `plaça(ces)` habría sido gramaticalmente raro e inconsistente con cómo se escribe "places" de verdad.

Decisión tomada: en vez de inventar un pseudo-sufijo roto, implementé la concordancia real: `` `${cantidad} ${cantidad === 1 ? 'plaça' : 'places'}` ``. Es más correcto que el original y cumple literalmente lo que pedía el punto 2 de la tarea ("confirma que la nueva frase sigue concordando en singular/plural correctamente"). Verificado con `cantidad: 2` → salió "2 places" en pantalla (ver verificación).

---

## Resultado de cada verificación

1. **Grep final** — repetido tras los cambios: solo quedan las apariciones ya justificadas arriba (identificadores/significado distinto). Cero texto visible pendiente.
2. **Visual en local** (navegador real, Postgres local, evento de prueba `[TEST-PLACA]`):
   - Checkout público: pestaña "Reserva la teva plaça", label "Nombre de places", botón "PAGAR I RESERVAR PLAÇA" — todo correcto.
   - Página de éxito: "Rebràs la confirmació de la teva plaça per email en breu." y "cancel·lar o modificar la teva plaça" — correcto.
   - Admin: cabecera de tabla "PLACES RESTANTS", tooltip del calendario "Places comprades: 2", historial "Compra #3 creada per Marc Test (2 places)" — todo correcto, con la pluralización de `models/Compra.js` funcionando bien con una compra de 2 places.
3. **Email de confirmación** generado sin enviarlo de verdad (Resend interceptado en el propio proceso): asunto `Confirmació de la teva plaça — [TEST-PLACA] Sopar de tardor`, cuerpo con `<li><strong>Places:</strong> 2</li>` — correcto.
4. **CSV de compras** descargado con sesión de admin real: cabecera `Nom,Email,Telèfon,Quantitat,Import total (€),Estat pagament,Data compra` — ya no contenía la palabra "Entrada" antes del cambio (no hacía falta tocarla), confirmado que sigue sin aparecer.
5. **`npm test`** — **41/41 pasan**, sin ningún ajuste necesario (el cambio es solo de texto/copy, ningún test dependía de estas cadenas literales).

Datos de prueba (`[TEST-PLACA] Sopar de tardor` y su compra) eliminados al terminar.
