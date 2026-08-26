# Tanda A — múltiples invitados por evento: esquema y backend

Solo esquema + backend, tal como se pidió. Nada de `public/js/admin.js`, `public/js/checkout.js` ni CSS.

---

## Qué se ha creado / cambiado

### `config/schema.sql`
- Comentario de `nombre_invitado`/`cargo_invitado` actualizado a `-- OBSOLETO: sustituït per evento_invitados...` — **no se han borrado**, siguen presentes tal como se pidió.
- Tabla nueva `evento_invitados` (`id`, `evento_id` FK a `eventos` con `ON DELETE CASCADE`, `nombre`, `cargo`, `orden`, `created_at`) + índice `idx_evento_invitados_evento`.
- `ALTER TABLE evento_invitados ENABLE ROW LEVEL SECURITY` añadido al bloque final, igual que las otras tres tablas.

### `utils/validarInvitados.js` (nuevo)
Módulo puro de validación (sin `require` de `config/db` ni de nada que toque la BD), siguiendo exactamente el mismo patrón que `utils/camposFormulario.js` — pero es un archivo **distinto**, no se ha tocado `camposFormulario.js` como pedía la instrucción explícita. Exporta `validarInvitados(invitados)`: exige lista no vacía, cada entrada con `nombre` no vacío; `cargo` es opcional.

**Decisión tomada por mi cuenta:** puse esta validación en un archivo propio en vez de dejarla como función local dentro de `adminController.js` (que era la ubicación "por defecto" siguiendo el patrón de `validarEvento`). Motivo: `adminController.js` no se puede importar sin tocar la BD real (arrastra `models/Evento.js` → `config/db.js`, que aplica `schema.sql` al cargar el módulo). Sacar la validación a un archivo puro la hace testeable en aislado — es exactamente lo que pedía el Paso 4 ("añade tests... si es razonable hacerlo sin tocar la BD real").

### `models/Evento.js`
- `CAMPS_AUDITABLES` ya no incluye `nombre_invitado`/`cargo_invitado` (columnas congeladas, ya no se escriben desde la app).
- Funciones nuevas exportadas: `getInvitados(eventoId)` (lista ordenada por `orden`) y `setInvitados(eventoId, invitados)` (reemplaza toda la lista: borra + inserta, sin CRUD granular por invitado, tal como se pidió).
- `getById()` y `getActivo()` ahora devuelven el evento con `.invitados` adjunto (vía un helper interno `ambInvitados`).
- `create()`: ya no acepta ni escribe `nombre_invitado`/`cargo_invitado`; acepta `data.invitados` y lo guarda con `setInvitados` tras crear la fila.
- `update()`: mismo tratamiento — `invitados` se toca solo si `data.invitados !== undefined` (igual que `campos_formulario`), y su cambio se registra en el historial comparando solo `nombre`/`cargo` (no los `id`/`orden` que genera la BD en cada reemplazo, para no generar entradas de auditoría falsas cuando se guarda la misma lista sin cambios reales).

**Decisión tomada por mi cuenta:** `listActivos()`/`listAll()` (usadas por el listado del admin y por `GET /api/evento/actius`) **no** adjuntan `invitados` — solo `getById`/`getActivo`, que son los dos caminos que alimentan `GET /api/evento/actual` (el endpoint que pedía el Paso 3). Añadirlo también a los listados habría significado una consulta extra por evento en pantallas de listado, sin que nadie lo haya pedido todavía. Si en la tanda de admin (frontend) hace falta mostrar los invitados en la tabla de eventos, habrá que revisitar esto.

### `controllers/adminController.js`
- `crearEvento`: valida `req.body.invitados` con `validarInvitados`, normaliza (`trim` de nombre, `cargo` vacío → `null`) y lo pasa a `Evento.create`. Ya no lee `nombre_invitado`/`cargo_invitado` del body.
- `actualitzarEvento`: mismo tratamiento condicionado a `req.body.invitados !== undefined`. Se quitaron `nombre_invitado`/`cargo_invitado` de la lista de campos que se copian tal cual del body.
- `obtenirEvento` no se ha tocado — ya devolvía `Evento.getById(id)` tal cual, así que ahora incluye `.invitados` automáticamente (útil para que la tanda de admin/frontend pueda rellenar el formulario de edición).

### `controllers/eventoController.js`
- `getEventoActual` (rama `disponible: true`, líneas donde antes se excluía a propósito) ahora expone `invitados: [{ nombre, cargo }, ...]` — sin `id` interno ni `orden` explícito (el array ya viene ordenado). La rama `disponible: false` sigue sin exponer nada de esto, igual que ya pasaba con `campos_formulario`.
- `getEventosActius` no se ha tocado — no exponía `campos_formulario` ni nada de invitados antes, y sigue sin hacerlo (consistente con que es un listado resumen, no la ficha del evento).

### `scripts/migrar-invitados.js` (nuevo)
Migra `eventos.nombre_invitado`/`cargo_invitado` → `evento_invitados` (una fila, `orden = 1`). Usa SQL directo contra `config/db`, no pasa por `Evento.listAll()` a propósito: esa función llama a `tancarExpirats()` internamente, que **cierra eventos automáticamente** como efecto secundario — un script de migración de datos no debería disparar lógica de negocio.

**Idempotencia:** antes de insertar, comprueba si el evento ya tiene alguna fila en `evento_invitados` (`SELECT ... LIMIT 1`); si ya tiene, lo salta sin tocarlo. No usa `ON CONFLICT` (no hay una constraint natural de unicidad que lo soporte sin inventar una columna extra) — el `SELECT` previo es suficiente y más simple, verificado en el paso 4 (ejecutado dos veces, la segunda no duplica nada).

### `tests/validarInvitados.test.js` (nuevo)
7 tests sobre `validarInvitados`, sin tocar la BD (import directo del módulo puro): no-lista, lista vacía, válido sin cargo, válido con varios, nombre vacío/solo-espacios/ausente, entrada no-objeto, e índice correcto del inválido entre varios.

---

## Resultado de cada punto de verificación (Paso 4)

Ejecutado contra el Postgres local (`docker-compose.local.yml`, que no estaba arrancado — lo levanté yo con `docker compose -f docker-compose.local.yml up -d`, sigue corriendo).

1. **Migración con datos de prueba** — creados 2 eventos "legacy" insertando `nombre_invitado`/`cargo_invitado` directamente por SQL (simulando el estado pre-migración), ejecutado `node scripts/migrar-invitados.js`: **OK**, ambos migrados correctamente (`orden=1`, `nombre`/`cargo` copiados tal cual).
2. **Idempotencia** — ejecutado el script una segunda vez: **OK**, "0 esdeveniment(s) migrat(s), 2 ja tenien invitats" — no duplica filas.
3. **Crear evento con 3 invitados vía controller** — `adminController.crearEvento` con 3 invitados en el body: **OK**, `201`, los 3 guardados con `orden` 1/2/3 en el orden enviado, cargo vacío normalizado a `null`.
4. **Crear/editar sin invitados falla** — `crearEvento` con `invitados: []` → **OK**, `400` con `detalls: ["cal almenys un convidat amb nom"]`. Añadido también un caso no pedido explícitamente pero relevante: `actualitzarEvento` de un evento existente con `invitados: []` → **OK**, también `400` (no se puede vaciar la lista por edición tampoco).
5. **`GET /api/evento/actual` expone invitados** — `eventoController.getEventoActual` para el evento de prueba: **OK**, `evento.invitados` con los 3, cada uno solo `{nombre, cargo}` (sin filtrar de más, sin exponer de menos).
6. **`npm test`** — **24/24 pasan** (17 preexistentes + 7 nuevos), sin tocar la BD real.
7. **Limpieza** — los 3 eventos de prueba (`[TEST-A] ...`) eliminados con `Evento.remove`; verificado por SQL directo que no queda ninguno y que `ON DELETE CASCADE` borró también sus filas de `evento_invitados`.

Ningún dato de prueba quedó en la base de datos al terminar.

---

## Notas para la siguiente tanda (frontend)

- El admin actual (`public/admin/evento.html` + `public/js/admin.js`) **todavía envía** `nombre_invitado`/`cargo_invitado` y no envía `invitados` — así que crear/editar un evento desde la UI actual **fallará** con "cal almenys un convidat amb nom" hasta que la tanda de frontend actualice ese formulario. Es el estado esperado, no un bug: el backend ya exige el campo nuevo.
- `obtenirEvento` (usado por el formulario de edición del admin) ya devuelve `evento.invitados`, listo para que el frontend lo consuma sin más cambios de API.
