# Diagnóstico — campos de invitado en la ficha + viabilidad de múltiples invitados

Read-only. No se ha modificado código ni base de datos. No se ha consultado el Postgres local (no hizo falta: el propio código deja el caso cerrado sin necesidad de mirar datos).

---

## PARTE 1 — Por qué "Nom del convidat" / "Càrrec del convidat" no aparecen en la ficha del comprador

**No son campos de `campos_formulario`.** Son dos columnas fijas de la tabla `eventos`: `nombre_invitado` y `cargo_invitado` (`config/schema.sql:23-24`), rellenadas por el admin al crear/editar el evento (`public/admin/evento.html:68-72`, con la etiqueta explícita "informatiu, opcional"; guardadas por `controllers/adminController.js:134-135` y `models/Evento.js:6,98-99,127,136,145`).

Esto ya está documentado en `CLAUDE.md`, sección "Notes de domini": *"eventos.nombre_invitado / cargo_invitado: camps informatius que introdueix l'admin, no responen a res que ompli el comprador."* No es información nueva, pero confirma que el diseño es intencionado, no un descuido de nomenclatura.

**Por qué no llegan al checkout:** la API pública que consume `checkout.js` (`GET /api/evento/...`, servida por `controllers/eventoController.js`) construye la respuesta con una lista blanca explícita de campos — no reenvía la fila del evento tal cual. En `controllers/eventoController.js:61-74`, el objeto `evento` que se devuelve incluye `id, nombre, fecha, descripcion, precio, fecha_limite_compra, aforo_disponible, aforo_total, campos_formulario` — y **no** incluye `nombre_invitado` ni `cargo_invitado`. Verificado con grep: estos dos campos no aparecen en `controllers/eventoController.js`, `public/js/checkout.js`, `public/js/success.js` ni `utils/mailer.js` — es decir, el dato nunca sale del backend administrativo hacia ningún sitio que vea el comprador.

**Diagnóstico:** no es un bug de omisión en el renderizado (no hay ninguna función que "debería" pintarlos y se olvide de dos campos de una lista). Es que el dato **nunca llega al frontend público** porque el contrato de la API pública lo excluye a propósito — son metadatos internos del evento (p. ej. "el conseller Fulano inaugura l'acte"), no datos de la compra ni preguntas para el comprador. Si el cliente quiere que esta información aparezca en la ficha/ticket/email, es un cambio de alcance nuevo (exponer `nombre_invitado`/`cargo_invitado` en la API pública y pintarlos donde corresponda), no una corrección de un fallo existente.

**Importante para la Parte 2:** esto significa que "el invitado del evento" (una persona relevante del acto, definida por el admin) y "los invitados que trae el comprador" (lo que pide la Parte 2, N acompañantes con nombre+cargo por compra) son dos conceptos **completamente distintos** que comparten nombre por casualidad. Conviene que el naming en código/UI los diferencie para no confundirlos (ver pregunta de producto #5 más abajo).

---

## PARTE 2 — Viabilidad de "más de 1 invitado" por compra

### Enfoque (a): tipo de campo nuevo "grupo repetible" dentro de `campos_formulario`/`respuestas_campos`

- **Modelo de datos:** ningún cambio de esquema — `respuestas_campos` ya es JSONB, así que el valor de un campo tipo `grupo` sería un array de objetos (`[{nombre: "...", cargo: "..."}, ...]`). Sin `ALTER TABLE`.
- **Backend:**
  - `utils/camposFormulario.js` — es donde vive todo el esfuerzo real. Añadir `'grupo'` a `TIPOS_VALIDOS`, un esquema de `subcampos` dentro de la definición del campo, validación recursiva en `validarDefinicionCampos` (ids únicos dentro del grupo, subcampos con su propio tipo/etiqueta), y en `validarRespuestas` tratar el valor como array: validar cada entrada contra los `subcampos`, más límites min/max de repeticiones si se piden.
  - `controllers/stripeController.js` y `controllers/misDatosController.js` — probablemente sin cambios, porque ambos ya delegan en `validarRespuestas` de forma genérica.
  - `controllers/adminController.js` — la exportación CSV (`llistarCompresEvento`, en torno a la línea 304-312) hoy vuelca `respuestas_campos` como columnas planas; con un grupo repetible necesitaría aplanar un array variable en columnas dinámicas ("Convidat 1 – Nom", "Convidat 2 – Nom"...), que es lógica nueva no trivial.
- **Frontend:** `public/js/checkout.js` y `public/js/mis-datos.js` necesitan lógica nueva de UI repetible (botón "añadir invitado", quitar, renumerar) — hoy el renderizador de campos dinámicos solo pinta campos sueltos según su tipo, no hay ningún concepto de repetición. Además `public/js/admin.js` (el constructor de `campos_formulario` que usa el admin al diseñar el evento, función `renderLlistaCamps`/`obrirModalCamp` sobre línea 920-995) necesitaría una UI nueva para definir un campo tipo grupo con sus subcampos.
- **Esfuerzo:** M en backend (concentrado en un único archivo, pero con recursión que hoy no existe), L en frontend (tres sitios con UI repetible hecha a mano, sin ningún framework). Total: **L**.

### Enfoque (b): tabla nueva `compra_invitados` con FK a `compras`

- **Modelo de datos:** tabla nueva sencilla — `compra_invitados(id, compra_id FK → compras, nombre, cargo, created_at)`. Encaja con el patrón ya usado en el proyecto (columnas planas, FK, sin ORM) — mismo estilo que `Evento.js`/`Compra.js`.
- **Backend:**
  - Modelo nuevo (`models/Invitados.js` o similar) siguiendo el mismo patrón `.prepare().get/.all/.run` que ya usan `Compra.js`/`Evento.js`.
  - `controllers/stripeController.js` — al crear la compra, insertar N filas de invitados. Como el proyecto **no tiene soporte de transacciones** en `config/db.js` (ya señalado como hallazgo CRÍTICO #4 en `_temp_repaso_proyecto_junior.md`), esto añade el mismo tipo de riesgo de atomicidad que ya existe hoy — no es un problema nuevo, pero sí un sitio más donde pesará si no se arregla la causa raíz.
  - `controllers/misDatosController.js` — editar la lista de invitados (borrar+reinsertar, o diff).
  - `controllers/adminController.js` — join o consulta aparte por compra para listar/exportar.
- **Frontend:** la UI repetible en `checkout.js` y `mis-datos.js` hace falta **igual que en el enfoque (a)** — ese trabajo no desaparece, es idéntico en ambos enfoques. La diferencia es que `admin.js` **no** necesita tocar el constructor de `campos_formulario` (a menos que el producto quiera que "acepta invitados" sea opt-in por evento, con un booleano o un min/max — mucho más simple que enseñarle al constructor genérico un tipo de campo nuevo).
- **Esfuerzo:** S-M en esquema+modelo, S-M en controllers, misma L de frontend que (a) para la UI repetible. Total: **M**.

### Recomendación: enfoque (b)

Es la opción más coherente con cómo está construido el resto del proyecto, por dos motivos concretos:

1. **`campos_formulario` está diseñado para preguntas sueltas y planas, no para entidades estructuradas repetibles.** Meterle un tipo "grupo" convierte el único módulo de validación limpio y de propósito único del proyecto (`utils/camposFormulario.js`, hoy 129 líneas totalmente puras, señalado en la auditoría previa como ejemplo de buen código) en dos sistemas de validación distintos superpuestos. Un invitado es una entidad (nombre + cargo que van juntos, con su propia identidad), no una respuesta a una pregunta.
2. **Ya existe precedente de "invitado" como concepto de primera clase** en el lado del evento (`nombre_invitado`/`cargo_invitado` en `eventos`, Parte 1). Una tabla `compra_invitados` extiende ese mismo vocabulario al lado del comprador, en vez de forzarlo dentro de un sistema genérico pensado para otra cosa.

El CSV/admin necesitará lógica de aplanado a columnas en ambos casos por igual — eso no inclina la balanza. Lo que sí la inclina es que (b) no toca el constructor de campos dinámicos del admin ni complica el único módulo de validación limpio del proyecto.

### Preguntas de producto que no puedo resolver yo

1. **¿Hay un máximo de invitados por compra?** Determina si el backend valida un límite duro y si el frontend usa un botón "añadir" abierto o un selector 1-N.
2. **¿El precio depende del número de invitados, o la entrada tiene precio fijo independientemente de cuántos invitados traiga?** Si depende, el cambio ya no es solo de formulario: afecta al cálculo de importe y al aforo en `stripeController.js` — sube de alcance.
3. **¿Es obligatorio al menos 1 invitado, o la compra puede no llevar ninguno?**
4. **¿Aplica a todos los eventos por igual, o es opt-in por evento** (como hoy lo es `campos_formulario`, que puede estar vacío)?
5. **¿Hay alguna relación entre "el invitado del evento" (`nombre_invitado`/`cargo_invitado`, el ponente/autoridad del acto) y "los invitados de la compra" (los acompañantes del comprador), o son conceptos sin relación que solo comparten la palabra?** Si no hay relación, conviene un nombre distinto en código/UI (p. ej. "acompañantes") para no confundirlos con el campo ya existente.

---

## PARTE 3 — Alcance del cambio en checkout público + admin

### Panel admin

- **Tabla de compras del evento** (`controllers/adminController.js`, función `llistarCompresEvento`, y su pintado en `public/js/admin.js`) — hoy asume una respuesta por campo; con N invitados necesita mostrar una lista o un resumen ("2 invitados") en vez de un valor plano.
- **Exportación CSV** (`utils/csv.js` + la función de export en `adminController.js`) — necesita columnas dinámicas o una columna-resumen, en ambos enfoques (a) y (b) por igual.
- **Constructor de `campos_formulario`** en `public/js/admin.js` (`renderLlistaCamps`, `obrirModalCamp`, líneas ~920-995) — **solo si se elige el enfoque (a)**. Con el enfoque (b) no hace falta tocarlo, salvo que se quiera un ajuste opt-in/min-max por evento (línea de producto, no técnica).

### Checkout público — mapa de archivos a tocar (sin diseñar aún)

- `public/js/checkout.js` — es donde vive `renderCampsFormulariDinamics` (línea 199) y el resto del flujo del formulario; ahí iría la UI repetible de invitados, tanto si es un tipo de campo nuevo (a) como si es una sección aparte alimentada por la tabla nueva (b).
- `public/js/mis-datos.js` — misma UI repetible duplicada para la edición posterior vía `edit_token` (el proyecto ya arrastra esta lógica de campos triplicada entre backend/checkout/mis-datos, señalado en la auditoría previa; este cambio añade una repetición más al mismo patrón).
- `public/js/success.js` — si la ficha de éxito debe listar los invitados introducidos.
- `utils/mailer.js` — si el email de confirmación debe incluir la lista de invitados.
- CSS: `public/css/forms.css` (estructura de formulario) y `public/css/style.css` (si importa parciales del checkout) son los candidatos más probables para el rediseño visual; `public/css/admin.css` si el admin necesita también ajuste visual en su tabla de compras. No se puede afinar más sin decidir primero el diseño.
