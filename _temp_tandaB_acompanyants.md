# Tanda B — formulario dinámico de acompañantes en checkout + vista en admin

Frontend únicamente, sobre el backend ya en producción (Tanda A). Verificado en vivo con navegador (Chrome) contra Postgres local.

---

## PASO 1 — Checkout público

### `public/index.html`
Añadido `<div id="acompanyants-dinamics"></div>` justo después del campo teléfono del comprador y antes del aviso de facturación — todo generado por JS, vacío por defecto (`cantidad=1` no muestra nada).

### `public/js/checkout.js`
- **`renderAcompanyants(n)`**: pinta `n` bloques (`.acompanyant-bloc`), cada uno con "Acompanyant N" + nombre/email (`required`, `type="email"`) + teléfono (opcional). El estado (`acompanyantsActuals`) es un array persistente: al subir `n` se añaden filas vacías al final; al bajar `n` se recorta el array por el final (`array.length = n`), así que los bloques que quedan **conservan exactamente lo que ya tenían escrito** — verificado en vivo (ver abajo).
- **`actualitzarAcompanyants()`**: lee `cantidad`, calcula `n = cantidad - 1` y llama a `renderAcompanyants`. Enganchado al evento `input` del campo `cantidad` y llamado una vez al cargar la página.
- **`enviarFormulari`**: si `cantidad > 1`, añade `body.acompanyants` (array `{nombre, email, telefono}`, recortados, mismo orden que los bloques en pantalla). Si `cantidad === 1`, **la clave `acompanyants` no se incluye en absoluto** en el body — decisión tomada leyendo la Tanda A: el backend no la lee cuando `cantidad === 1`, así que ni falta ni sobra.
- **Validación en frontend**: sin JS adicional — reutiliza el mismo mecanismo que ya usa el resto del formulario (atributos `required`/`type="email"` nativos del HTML, que bloquean el `submit` del propio `<form>` antes de que se dispare el listener). Es el mismo patrón que ya usan `nombre_comprador`/`email` del comprador principal, así que no introduje una validación nueva y distinta.
- **Errores del backend**: no hizo falta tocar nada — el manejo de `data.detalls` en el `catch` de `enviarFormulari` ya era genérico (`errorEl.textContent = data.detalls ? data.detalls.join(', ') : ...`), así que mensajes como `"acompanyant 2: email invàlid"` ya se muestran igual que cualquier otro error de validación, sin código adicional.

### `public/css/forms.css`
Bloque nuevo (`.acompanyants-titol`, `.acompanyant-bloc`, `.acompanyant-subtitol`): separador fino superior entre acompañantes (no en el primero), mismos tokens tipográficos que el resto del formulario. Los labels de nombre/email ya reciben el asterisco rojo automáticamente vía la regla CSS genérica `label:has(+ input[required])::after` que ya existía — no dupliqué esa lógica.

---

## PASO 2 — Admin: ver acompañantes de una compra

### Decisión de UI — necesita tu visto bueno
En vez de una fila siempre visible o un tooltip al pasar el ratón, elegí: **la cifra de "Quantitat" se convierte en un botón** (subrayado punteado, discreto, no parece un botón de acción normal) **solo cuando la compra tiene acompañantes** — al hacer clic, despliega una fila de detalle justo debajo con nombre/email/teléfono de cada uno, plegable de nuevo con un segundo clic. Si `cantidad === 1` (sin acompañantes), la celda es texto plano, sin ningún control.

Elegí esto en vez de un tooltip porque un tooltip se pierde al mover el ratón (mal para copiar un email) y en vez de una fila siempre visible porque saturaría la tabla en eventos con muchas compras de varias plazas. Es el mismo patrón de interacción que ya usa el propio admin en otros sitios (el detalle del historial se abre con un clic, no con hover).

### `public/js/admin.js` (`carregarCompras`)
- Cada compra con `acompanyants.length > 0` pinta la celda de Quantitat como `<button class="btn-veure-acompanyants">` con el número + un icono de flecha (`aria-expanded`, `aria-controls` para accesibilidad) y añade una `<tr class="fila-acompanyants hidden">` justo debajo con el detalle, usando `colspan` calculado dinámicamente (6 columnas base + columnas de `campos_formulario` + columna de acciones).
- El icono de la flecha se generó primero como el carácter Unicode "▾", pero **no renderizaba bien a tamaño pequeño** (se veía como un punto diminuto en vez de una flecha) — lo sustituí por el mismo SVG chevron que ya usa el propio proyecto en el desplegable de prefijo telefónico del checkout (`public/js/checkout.js`), en vez de introducir un icono nuevo. También añadí `white-space: nowrap` + `display: inline-flex` al botón porque el número y el icono se estaban partiendo en dos líneas dentro de la celda estrecha — verificado y corregido en vivo (dos iteraciones, comprobadas con captura de pantalla en cada una).
- El toggle abre/cierra de forma independiente por compra (no es un acordeón exclusivo) — informativo, no editable, tal como pedía el encargo.

### `public/css/admin.css`
Estilos nuevos: `.btn-veure-acompanyants` (texto subrayado punteado, sin fondo de botón), `.fila-acompanyants td` (fondo ligeramente teñido para diferenciarla de las filas normales), `.acompanyants-detall-titol`/`.acompanyants-detall-fila` (mismo patrón tipográfico que el resto del admin — eyebrow + filas nombre/email/teléfono).

---

## Resultado de cada verificación

1. **Cambiar "Nombre de places" de 1 a 3** → aparecen 2 bloques "Acompanyant 1"/"Acompanyant 2" al instante. **Bajar a 2** → queda solo "Acompanyant 1", **con los datos que ya tenía escritos intactos** (probado escribiendo "Anna Roig" / "anna@example.com" en el acompañante 1 antes de bajar la cantidad, confirmado que seguían ahí después).
2. **Compra real con 3→2 plazas y 1 acompañante válido** (Anna Roig) → **éxito**, redirección a Stripe. Confirmado por SQL directo: la compra quedó con `cantidad=2` y el acompañante guardado correctamente (`nombre`, `email`, `telefono: null` porque se dejó vacío).
3. **Acompañante con email inválido** (`email-invalido-sin-arroba`) → el navegador **bloqueó el envío** (el foco quedó en el campo de email, sin redirección a Stripe, sin llamada al backend) — validación nativa `type="email"` funcionando tal como se esperaba, sin necesitar JS adicional.
4. **Compra con `cantidad=1`** → ningún bloque de acompañante visible en ningún momento, formulario funciona exactamente igual que antes de esta tanda, redirección a Stripe normal. Confirmado.
5. **Ver esa compra desde el admin** → la fila con acompañantes muestra el botón "2 ⌄"; al hacer clic se despliega "ACOMPANYANTS" con "Anna Roig — anna@example.com". La compra con `cantidad=1` no muestra ningún control, solo el número.
6. **`npm test`** — **50/50 pasan**, sin ningún cambio necesario (backend no tocado en esta tanda).

Datos de prueba (`[TEST-ACOMPANYANTS-B] Sopar de prova` y sus 2 compras) eliminados al terminar, confirmado por SQL directo (`eventos: 0, compras: 0, acompanyants: 0`).

---

## Resumen de decisiones que necesitan tu visto bueno

1. **UI del admin**: clic en la cifra de "Quantitat" para desplegar/plegar el detalle (en vez de tooltip o fila siempre visible). Detallado arriba, con la razón de por qué descarté las otras dos opciones.
2. **Icono de la flecha**: sustituí el carácter "▾" por un SVG (por problema real de renderizado, no por preferencia estética) — reutilicé el chevron que ya existía en el proyecto en vez de crear uno nuevo.
3. **CSV**: no añadí los acompañantes al CSV de exportación — no se pidió explícitamente en esta tanda (solo "ver acompañantes de una compra" en el admin) y me pareció fuera de alcance; dímelo si lo quieres para la próxima.
