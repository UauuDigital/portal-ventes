# Eliminar facturación del checkout

Eliminada toda la funcionalidad de "Vull factura amb dades fiscals": frontend, backend, esquema, email interno y admin. Verificado con Postgres local recreado desde cero.

---

## PASO 1 — Checkout público (`public/index.html`, `public/js/checkout.js`, `public/js/i18n.js`)

- Quitado el checkbox `quiere_factura` y el bloque `#camps-fiscals` (inputs `nif`, `nombre_fiscal`, `direccion_fiscal`) de `public/index.html`.
- Añadido el texto fijo en su lugar:
  ```html
  <p class="factura-avis" data-i18n-html="factura_avis">En cas de necessitar factura, escriure un correu a <a href="mailto:anna@uauu.cat">anna@uauu.cat</a>.</p>
  ```
- **Decisión técnica**: usé el atributo `data-i18n-html` (no `data-i18n`) porque `data-i18n` solo asigna `textContent` — no puede insertar un `<a>` real dentro del texto traducido. `data-i18n-html` ya existe en el proyecto y hace `el.innerHTML = t(...)` (`i18n.js:445-446`); además hay precedente exacto en el propio código: la clave `com_cancelar_modificar` (página de éxito) ya incrusta un `mailto:anna@uauu.cat` de la misma forma. Reutilicé ese patrón en vez de inventar uno nuevo o partir la frase en varias claves.
- `checkout.js`: eliminada la función `toggleCampsFiscals` (ya no hay nada que desplegar), su listener, y los 4 campos (`quiere_factura`, `nif`, `nombre_fiscal`, `direccion_fiscal`) del body que se envía a `POST /api/checkout/crear`.
- `i18n.js`: eliminadas las claves `checkbox_factura`, `label_nif`, `label_nom_fiscal`, `label_direccio_fiscal` (×3 idiomas) y `avis_dos_correus` (×3 idiomas, ver Paso "success.js" abajo). Añadida `factura_avis` (×3 idiomas):
  - ca: *"En cas de necessitar factura, escriure un correu a anna@uauu.cat."* (texto pedido, tal cual)
  - es: *"En caso de necesitar factura, escribe un correo a anna@uauu.cat."*
  - en: *"If you need an invoice, email anna@uauu.cat."*
- **`public/js/success.js`** (no estaba en la lista explícita del prompt, pero es forzoso): usaba `data.compra.quiere_factura` (devuelto por `obtenerConfirmacion`) para mostrar el aviso "recibirás dos correos". Eliminado el bloque `avisFactura` entero — la propia clave `avis_dos_correus` que usaba ya no tiene sentido sin el campo, así que se eliminó también de `i18n.js`.
- CSS: eliminada `.fiscal-fields` (forms.css, ya sin uso) y añadida `.factura-avis`/`.factura-avis a` con las mismas variables tipográficas que `.checkbox-row` (mismo tamaño/peso/color), para no introducir estilos sueltos.

## PASO 2 — Backend: validación (`controllers/stripeController.js`)

- Eliminado el bloque `if (body.quiere_factura) {...}` de `validarBody` (mensajes `'dades fiscals incompletes'`, `'nif invàlid'`).
- Eliminadas las constantes `NIF_REGEX`/`NIE_REGEX`/`CIF_REGEX` y la función `nifValid`, ya sin ningún uso.
- Eliminados los 4 campos fiscales del objeto pasado a `Compra.create()`.
- `obtenerConfirmacion`: eliminado `quiere_factura` de la respuesta JSON (lo consumía `success.js`, ver arriba).

## PASO 3 — Esquema (`config/schema.sql`, `models/Compra.js`)

- Borradas por completo (no comentadas) las 4 líneas de columnas en la tabla `compras`: `quiere_factura`, `nif`, `nombre_fiscal`, `direccion_fiscal`.
- `models/Compra.js`: quitadas esas 4 columnas del `INSERT` y de los valores por defecto en `create()`.

**⚠️ Importante — esto NO toca la base de datos de producción (Supabase).** `schema.sql` se aplica con `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`: nunca hace `DROP COLUMN`. El efecto real de este cambio es:
- **Bases de datos nuevas** (o el Postgres local recreado desde cero): nunca tendrán estas 4 columnas — confirmado en la verificación.
- **Supabase de producción**: seguirá teniendo las 4 columnas hasta que se ejecute manualmente algo como:
  ```sql
  ALTER TABLE compras
    DROP COLUMN quiere_factura,
    DROP COLUMN nif,
    DROP COLUMN nombre_fiscal,
    DROP COLUMN direccion_fiscal;
  ```
  No lo he ejecutado yo — no tengo acceso a esa instancia, y es una acción destructiva sobre datos de producción que corresponde decidir cuándo lanzar (aunque confirmaste que no hay compras reales con estos datos, así que no hay pérdida real de información).
- **Entre el despliegue de este cambio y ese `ALTER TABLE` manual, todo sigue funcionando sin errores**: `quiere_factura` es `NOT NULL DEFAULT false` en la tabla vieja, así que un `INSERT` que ya no la nombra usa el default automáticamente; `nif`/`nombre_fiscal`/`direccion_fiscal` son `TEXT` nullable, sin problema tampoco. Verificado explícitamente en el Paso 2 de la verificación (ver abajo).

## PASO 4 — Email interno (`utils/mailer.js`)

Aquí me desvié deliberadamente de la instrucción literal "elimina la interpolación" en un punto, y lo explico porque me pediste no asumir:

- **`VARIABLES_DISPONIBLES` conserva la clave `dades_factura`**, pero ahora siempre vale `''` (antes se calculaba desde `compra.quiere_factura`/`nombre_fiscal`/`nif`/`direccion_fiscal`). Motivo: `substituirVariables` hace `texto.split('{{clau}}').join(valor)` para cada clave de esa lista. Si hubiera **quitado** la clave del array en vez de vaciar su valor, cualquier evento con un `email_html` personalizado ya guardado que todavía contenga literalmente `{{dades_factura}}` habría empezado a enviar ese texto sin sustituir al comprador. Verificado explícitamente (ver Paso 4 de la verificación): con la clave presente y vacía, ese caso se sustituye limpiamente por nada; probé también quitarla mentalmente y no lo hice — la dejé tal como está ahora.
- Quitada la línea `{{dades_factura}}` de `HTML_DEFECTE` (la plantilla por defecto ya no la necesita).
- Quitada la mención de `{{dades_factura}}` de las "Variables disponibles" que ve el admin en `public/admin/evento.html` — no tiene sentido seguir publicitándola para plantillas nuevas.
- `enviarEmailPrueba`: quitados los campos fiscales de ejemplo (`compraExemple`).

### Diagnóstico explícito sobre `enviarNotificacioFactura` (email a digital@uauu.cat)

**Su único propósito era notificar a digital@uauu.cat las dades fiscales para que el equipo emitiera la factura manualmente. Sin facturación, esa función no tiene ningún contenido que enviar — su cuerpo entero (asunto, HTML) es facturación.**

Lo que he hecho, siguiendo tu instrucción de no asumirlo yo:
- Eliminada su **única llamada**, en el `webhook()` de `stripeController.js` (`if (compra.quiere_factura) { await enviarNotificacioFactura(...) }`), porque ese bloque referenciaba una columna que ya no existe — no podía quedarse tal cual.
- Eliminado el import ya no usado en `stripeController.js`.
- **La función en sí sigue intacta y exportada en `utils/mailer.js`**, con un comentario nuevo explicando que está huérfana (nadie la llama) y que la decisión de borrarla del todo o reutilizarla es tuya.

**Mi recomendación: elimínala.** No hay ningún escenario donde tenga sentido conservar una función que nunca se invoca y cuyo contenido entero (fiscal) ya no existe en el sistema. Si en el futuro quieres una notificación interna distinta a digital@uauu.cat (por otro motivo), sería más limpio escribirla de cero que reciclar el cascarón de esta.

## PASO 5 — Admin y CSV

- `controllers/adminController.js`: quitadas 4 entradas de `COLUMNES_CSV` (`Factura`/`NIF`/`Nom fiscal`/`Adreça fiscal`) y el cálculo `quiere_factura_text` en `exportarComprasCsv`.
- `public/js/admin.js`: quitadas las 4 `<td>` correspondientes de la fila de cada compra en la tabla del admin.
- `public/admin/evento.html`: quitadas las 4 `<th>` de cabecera de esa misma tabla.

---

## Resultado de cada verificación

1. **Checkout público sin checkbox/campos, con el texto nuevo** — confirmado visualmente (navegador real, Postgres local): el formulario ya no muestra ningún campo fiscal; aparece "En cas de necessitar factura, escriure un correu a **anna@uauu.cat**" con el enlace `mailto:anna@uauu.cat` correctamente formado. Confirmado también en castellano ("En caso de necesitar factura, escribe un correo a anna@uauu.cat.") e inglés ("If you need an invoice, email anna@uauu.cat.").
2. **Body con campos fiscales (cliente viejo/caché)** — enviado un `POST /api/checkout/crear` real con `quiere_factura: true, nif, nombre_fiscal, direccion_fiscal` incluidos en el body. **Resultado: se ignoran silenciosamente, sin error.** La compra se creó con normalidad (`201`, URL de Stripe devuelta) y, al inspeccionar la fila en `compras`, no hay rastro de esos campos — ni columna donde guardarlos, ni error por campos desconocidos (el motor de `config/db.js` solo lee del body los parámetros nombrados explícitamente en el SQL).
3. **`schema.sql` desde cero** — `docker compose -f docker-compose.local.yml down -v && up -d` (Postgres completamente vacío) y arrancado el servidor para que aplique `schema.sql`. Columnas resultantes de `compras`: `id, evento_id, nombre_comprador, email, telefono, cantidad, importe_total, stripe_checkout_session_id, estado_pago, created_at, respuestas_campos, edit_token` — **sin ninguna columna fiscal**.
4. **Email interno sin huecos raros** — generado (sin enviar de verdad; Resend interceptado en el propio proceso) el HTML del email de confirmación al comprador: limpio, sin ningún resto de `{{dades_factura}}` ni bloque vacío. Probado además el caso límite explícitamente: un evento con `email_html` personalizado que todavía contuviera `{{dades_factura}}` (simulando una plantilla guardada antes de este cambio) — el placeholder se sustituye por una cadena vacía, **nunca queda el texto literal `{{dades_factura}}`** en el correo que recibiría el comprador.
5. **CSV export** — descargado con sesión de admin real: cabecera `Nom,Email,Telèfon,Quantitat,Import total (€),Estat pagament,Data compra` — sin `Factura`/`NIF`/`Nom fiscal`/`Adreça fiscal`.
6. **`npm test`** — **24/24 pasan**, sin ningún ajuste necesario (ningún test existente dependía de estos campos, confirmado por grep antes de tocar nada).

Datos de prueba (`[TEST-FACTURA] Evento de prueba` y su compra) eliminados al terminar.

---

## Resumen de la decisión que necesita tu confirmación

**`utils/mailer.js` → `enviarNotificacioFactura` (email a digital@uauu.cat): recomiendo eliminarla del todo.** Hoy está huérfana (código exportado pero sin ninguna llamada en el proyecto) porque su contenido entero era facturación. La he dejado intacta a propósito, tal como pediste, en vez de borrarla o dejarla enviando datos vacíos/rotos. Dime si la elimino en una tanda siguiente.
