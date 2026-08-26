# Tanda B — admin + checkout público: múltiples invitados por evento

Frontend únicamente, sobre el backend ya en producción (Tanda A). Verificado en vivo con navegador (Chrome vía automatización) contra el Postgres local.

---

## Qué se ha creado / cambiado

### `public/js/admin.js`
- **Función reutilizable `crearGestorInvitados(idContenidor)`** (nueva, top-level, cerca de `escapeAttr`): gestiona una lista dinámica de convidados (nombre + cargo), reutilizada tanto en el formulario de creación como en el de edición — evita duplicar la lógica dos veces. API: `afegir()` (añade fila vacía), `carregar(llista)` (carga una lista existente, o reinicializa a una fila vacía si está vacía/no válida), `obtenirValid()` (devuelve solo las filas con nombre no vacío, recortadas de espacios).
- Mismo patrón visual/interacción que la lista de opciones de un campo de `campos_formulario` (`fila-opcio-camp`): input(s) en línea + botón circular de eliminar, re-renderizado completo en cada cambio. **No** he tocado `campos_formulario` ni su código — son sistemas independientes, tal como pedía el prompt.
- **Bloqueo del botón eliminar en la última fila**: siempre queda al menos una fila visible en pantalla (nunca se puede llegar a 0 filas desde la UI). Decisión propia: ver más abajo.
- Formulario de creación (`if (taulaEventos) {...}`): construye `invitados` con `gestorInvitatsCrear.obtenirValid()` en vez de leer `nombre_invitado`/`cargo_invitado`; valida `invitados.length === 0` antes de enviar (mismo `errorEl` que ya usaba la validación de fecha límite); tras crear con éxito, reinicia la lista a una fila vacía.
- Formulario de edición (`if (formEventoEditar) {...}`): `carregarEvento()` rellena la lista con `evento.invitados` (ya venía en la respuesta de `obtenirEvento`, sin tocar backend); el submit valida y envía `invitados` igual que arriba.

### `public/admin/index.html` y `public/admin/evento.html`
Sustituidos los dos `<input>` fijos (`nombre_invitado`/`cargo_invitado`) por:
```html
<div class="invitats-seccio">
  <label>Convidats / ponents</label>
  <p class="invitats-ajuda">Persona o persones que fan la ponència abans del dinar. Cal almenys una.</p>
  <div id="llista-invitats"></div>
  <button type="button" id="btn-afegir-invitat" class="btn-secundari">+ Afegir convidat</button>
</div>
```
Mismos ids en ambas páginas (nunca coinciden en el DOM a la vez, igual que `id="nombre"` ya se repite entre las dos páginas hoy).

### `public/css/admin.css`
Bloque nuevo `.invitats-seccio` / `.fila-invitat` (input nombre + input cargo + botón circular de eliminar), calcado del patrón visual ya existente de `.fila-opcio-camp` para mantener consistencia dentro del propio admin.

### `public/index.html` (checkout público)
Nuevo bloque `.evento-convidats` dentro del panel oscuro (`panel-color`), entre el título/descripción del evento y el bloque de fecha/precio/aforo:
```html
<div class="evento-convidats hidden" id="evento-convidats">
  <span class="eyebrow" data-i18n="evento_convidats_titol">Ponents</span>
  <div id="evento-convidats-llista"></div>
</div>
```
Reutiliza la clase `.eyebrow` ya existente en el proyecto (usada en `success.html`/`cancel.html`/`mis-datos.html`) en vez de inventar un estilo de etiqueta nuevo.

### `public/css/layout.css`
Reglas nuevas `.evento-convidats`, `.evento-convidat`, `.evento-convidat-nom`, `.evento-convidat-carrec`. **Decisión de diseño clave**: el separador entre convidados (`border-top` fina, `rgba(255,255,255,0.12)`, mismo tono que el resto del panel oscuro) se aplica con el selector `.evento-convidat + .evento-convidat` — es decir, **solo aparece cuando hay 2 o más**, nunca con un único convidado. Así se cumple literalmente "si es 1 solo que no se vea raro" sin necesitar una rama de JS distinta para el caso de 1 vs. varios: es puro CSS declarativo, el mismo marcado sirve para ambos casos.

### `public/js/checkout.js`
Nueva función `renderConvidats(invitados)`: filtra entradas sin nombre, pinta `nombre` en negrita blanca y `cargo` (si existe) debajo en gris tenue; oculta el bloque entero (`classList.add('hidden')`) si la lista queda vacía — cubre tanto el caso `disponible:false` como, por defensiva, un evento sin invitados (aunque el backend ya garantiza mínimo 1). Llamada desde `carregarEvento()` con `ev.invitados`.

### `public/js/i18n.js`
Clave nueva `evento_convidats_titol` en los tres idiomas: **"Ponents"** (ca) / **"Ponentes"** (es) / **"Speakers"** (en). Es una etiqueta de sección fija (no numerada), no traduce nombres de personas (no aplica, son nombres propios).

### Cache-busting
Versiones `?v=N` incrementadas manualmente (patrón ya existente en el proyecto) en los archivos tocados: `admin.css` (88→89), `admin.js` (60→61) en `login.html`/`evento.html`/`index.html` (admin); `style.css` (9→10), `checkout.js` (17→18), `i18n.js` (2→3) y el `@import` interno de `layout.css` (16→17) en `public/index.html`.

---

## Verificación (Postgres local, navegador real)

1. **Crear evento con 3 invitados desde el admin** — modal "Crear esdeveniment": fila inicial con el botón eliminar deshabilitado (no se puede quedar en 0 filas); tras escribir el primer nombre aparece automáticamente una segunda fila vacía y el botón eliminar de la primera se activa; añadidos "Joana Puig / Consellera", "Marc Serra / (sin cargo)", "Anna Roig / (sin cargo)". **Guardado correcto**: `POST /api/admin/eventos` con `invitados: [...]`, evento creado con los 3 en `evento_invitados`, orden 1/2/3.
2. **Editar el mismo evento**: al abrir `evento.html?id=6`, la lista se precargó con los 3 nombres exactos desde `evento.invitados` (confirmando que `obtenirEvento` ya los sirve sin cambios de backend). Eliminado "Marc Serra", añadido "Pere Vidal / Director financer", guardado. **Resultado final correcto**: Joana Puig, Anna Roig, Pere Vidal — ni rastro de Marc Serra, ni mezcla con datos antiguos. Confirmado además en el **historial de auditoría** del propio admin: la entrada "MODIFICACIÓ" muestra el diff exacto de `invitados` (antes: Joana/Marc/Anna → después: Joana/Anna/Pere), sin ruido de ids internos — tal como se diseñó en la Tanda A.
3. **Checkout público con 3 invitados**: sección "PONENTS" visible en el panel oscuro, cada convidado en su propia fila con separador fino entre ellos, cargo en gris tenue debajo del nombre cuando existe (Anna Roig, sin cargo, no deja hueco raro).
4. **Checkout con 1 solo invitado**: reducida la lista a "Joana Puig / Consellera" desde el admin (botón eliminar de la última fila deshabilitado en el propio formulario, tal como se diseñó) y guardado. En el checkout público se ve limpio: "PONENTS" + una única fila, **sin separador** (el CSS `+` no dispara con un solo elemento) y sin ningún tipo de numeración — exactamente el efecto pedido.
5. **Cambio de idioma (CA→ES)** en el checkout: la etiqueta cambia de "PONENTS" a "PONENTES" correctamente vía el sistema `data-i18n` existente.
6. **`npm test`**: **24/24 pasan**, sin cambios respecto a la Tanda A (esta tanda es solo frontend, no toca ningún archivo con tests).
7. **Limpieza**: el evento de prueba `[TEST-B] Sopar amb 3 ponents` se eliminó al terminar (vía `Evento.remove` directo, no desde el botón del admin — ver nota técnica abajo). Confirmado que no queda ni el evento ni sus filas en `evento_invitados` (borrado en cascada).

### Nota técnica sobre la verificación
El botón "Eliminar esdeveniment" del admin dispara un `window.confirm()` nativo del navegador, que bloquearía la sesión de automatización (los diálogos nativos detienen la comunicación con la extensión). Por eso la limpieza del evento de prueba se hizo con una llamada directa a `Evento.remove()` desde un script Node puntual, exactamente igual que en la Tanda A — no se ha tocado el flujo de eliminación en sí, solo se ha evitado activarlo por automatización.

---

## Decisiones de diseño tomadas por mi cuenta (necesitan tu visto bueno)

1. **La última fila de invitados no se puede eliminar desde el formulario** (el botón "✕" se desactiva cuando solo queda una). Alternativa que no elegí: permitir vaciar la lista del todo y mostrar un mensaje "cal almenys un convidat" solo al intentar guardar. Elegí bloquear porque es más simple para quien usa el admin (nunca ve un formulario "vacío" de convidados) y evita un estado intermedio confuso; la validación de nombre vacío en la fila restante sigue existiendo igualmente al guardar.
2. **Etiqueta de sección "Ponents"/"Ponentes"/"Speakers"** sobre la lista del checkout público — no pedías un texto concreto. Elegí esta palabra por ser la más natural en el contexto ("quién presenta la ponencia"); si prefieres otra ("Convidats", "Amb la participació de"...) es un cambio de una sola clave de traducción en `i18n.js`.
3. **Reutilicé la clase `.eyebrow`** ya existente en el proyecto para esa etiqueta en vez de crear un estilo nuevo — visualmente es el mismo patrón que ya usan `success.html`/`cancel.html`, así que debería sentirse coherente, pero es una decisión estética que no se pidió explícitamente.
4. **Posición del bloque de invitados en el checkout**: lo coloqué entre la descripción del evento y el bloque de fecha/precio/aforo (dentro del panel oscuro), tratándolo como parte del "sobre el evento" en vez de como un dato logístico más. Si prefieres que vaya después de fecha/precio/aforo (más abajo, menos protagonismo) es un cambio de una línea en `index.html`.
