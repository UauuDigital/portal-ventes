# Tanda A — datos de acompañantes: esquema y backend

Solo esquema + backend, tal como se pidió. Nada de `public/js/checkout.js`, HTML del checkout ni admin.js/CSS. `evento_invitados` (ponentes) no se ha tocado.

---

## Qué se ha creado / cambiado

### `config/schema.sql`
- Tabla nueva `compra_acompanyants`: `id`, `compra_id` (FK a `compras`, `ON DELETE CASCADE`), `nombre`, `email`, `telefono`, `orden`, `created_at`. Mismo patrón exacto que `evento_invitados`.
- Índice `idx_compra_acompanyants_compra` en `compra_acompanyants(compra_id)`.
- `ALTER TABLE compra_acompanyants ENABLE ROW LEVEL SECURITY` añadido al bloque final, igual que las demás tablas.
- Sin script de migración — confirmado, no había datos previos que migrar (feature nueva).

### `utils/validacio.js` (nuevo)
Extraje `EMAIL_REGEX` a este módulo compartido, sin ninguna dependencia de BD. Motivo: la tarea pedía reutilizar literalmente el mismo regex que ya usa `stripeController.js` para el comprador, pero `utils/validarAcompanyants.js` necesita seguir siendo testeable en aislado (sin tocar BD) — si hubiera importado `EMAIL_REGEX` directamente desde `stripeController.js`, habría arrastrado toda su cadena de `require` (Evento → Compra → config/db), rompiendo justo la propiedad de aislamiento que pedía la tarea. Con este módulo compartido, `stripeController.js` y `utils/validarAcompanyants.js` usan exactamente la misma constante, y de paso elimina una duplicación que ya existía (el mismo regex estaba copiado también en `controllers/adminController.js` — ese no lo he tocado, fuera de alcance de esta tanda).

### `utils/validarAcompanyants.js` (nuevo)
Mismo patrón que `utils/validarInvitados.js`: módulo puro, sin `require` de `config/db`, testeable en aislado. Exporta `validarAcompanyants(acompanyants, cantidad)`:
- Exige que `acompanyants` sea un array de longitud exactamente `cantidad - 1` (mensaje pluralizado correctamente: "calen exactament 1 acompanyant" vs "calen exactament 2 acompanyants").
- Cada acompañante: `nombre` no vacío, `email` con el formato de `EMAIL_REGEX` compartido. `telefono` es opcional — confirmado leyendo `stripeController.js:validarBody`, el del comprador principal tampoco es obligatorio (`if (telefono && !TELEFON_REGEX.test(telefono))`, solo se valida el formato si se envía), así que apliqué el mismo criterio.

### `models/Compra.js`
- `getAcompanyants(compraId)`: lista ordenada por `orden`, mismo patrón que `Evento.getInvitados`.
- `setAcompanyants(compraId, acompanyants)`: reemplaza toda la lista (borra + inserta), mismo patrón que `Evento.setInvitados`. Sin CRUD granular.
- `create()`: ahora acepta `data.acompanyants` y llama `setAcompanyants` dentro de la misma función, justo después del `INSERT` de la compra — mismo patrón que `Evento.create` con `invitados`. **No introduje ninguna transacción**: confirmé que `Evento.create` tampoco la usa para su tabla hija equivalente, así que mantuve la consistencia con el patrón ya establecido en el proyecto (que no usa transacciones en ningún punto de `config/db.js`).

  **Decisión tomada por mi cuenta:** `Compra.getById()` (usada en el webhook, en `obtenerConfirmacion`, en `cancelarCheckoutSession`, etc.) **no** adjunta `acompanyants` automáticamente — a diferencia de cómo `Evento.getById` sí adjunta `invitados` siempre. Motivo: adjuntarlo ahí añadiría una consulta extra a cada lectura de compra en toda la app (cada evento de webhook de Stripe, cada carga de la página de éxito...) que hoy no necesita esa información. En su lugar, `create()` adjunta `acompanyants` al objeto devuelto y al registro de historial de forma puntual (una sola vez, justo al crear), y quien de verdad necesite consultarlos después (el admin) llama a `Compra.getAcompanyants(id)` explícitamente. Mismo criterio que ya se aplicó en la tanda de `evento_invitados` para `listAll()`/`listActivos()`.

### `controllers/stripeController.js`
- `EMAIL_REGEX` local eliminado; ahora importado desde `utils/validacio.js` (mismo valor, sin duplicación).
- `crearCheckoutSession`: tras la validación de `campos_formulario`, si `cantidad > 1` valida `req.body.acompanyants` con `validarAcompanyants`; si `cantidad === 1`, la validación **no se ejecuta en absoluto** — el campo, si llega, se ignora sin más (ver Verificación punto 5).
- Los acompañantes normalizados (`nombre`/`email`/`telefono` recortados, email en minúsculas) se pasan a `Compra.create(..., acompanyants: acompanyantsNormalizados)`.

### `controllers/adminController.js`
- `llistarCompresEvento`: cada compra devuelta ahora incluye `acompanyants` (vía `Compra.getAcompanyants`), además de seguir excluyendo `edit_token` como ya hacía. Es el punto que consume el admin para ver la lista de compras de un evento — la vista de detalle de acompañantes en la tabla es tarea de la siguiente tanda (frontend), pero el dato ya viaja en la API.

### `tests/validarAcompanyants.test.js` (nuevo)
9 tests sobre `validarAcompanyants`, sin tocar BD (import directo del módulo puro, igual que `validarInvitados.test.js`): no-lista, número incorrecto (por defecto y por exceso), pluralización del mensaje con 1 vs varios, lista válida completa, teléfono opcional, nombre vacío, email inválido/ausente, entrada no-objeto, índice correcto del inválido entre varios.

---

## Resultado de cada punto de verificación

Ejecutado contra el Postgres local (`.env.local`, `docker-compose.local.yml` servicio `db`).

1. **`cantidad=3` + 2 acompañantes válidos** — `POST /api/checkout/crear` → **éxito** (`200`, URL de Stripe). Verificado directamente en `compra_acompanyants`: las 2 filas se guardaron con el `compra_id` correcto (4), orden 1/2 preservado, el teléfono opcional del segundo se guardó y el del primero quedó `null`.
2. **`cantidad=3` + solo 1 acompañante** → **rechazada**, `400`, `{"detalls":["calen exactament 2 acompanyants (n'hi ha 1)"]}`. Probado también con 0 acompañantes → mismo resultado con "n'hi ha 0". Mensajes claros en ambos casos.
3. **`cantidad=3` + 2 acompañantes, uno con email inválido** → **rechazada**, `400`, `{"detalls":["acompanyant 2: email invàlid"]}` — señala exactamente cuál de los dos falla.
4. **`cantidad=1` sin acompañantes** → **éxito normal**, `200`, comportamiento actual sin cambios (confirmado explícitamente, no solo asumido).
5. **`cantidad=1` pero enviando acompañantes de todos modos** — **Decisión explícita: se ignoran silenciosamente, sin error.** La petición tuvo éxito (`200`) exactamente igual que sin el campo, y verificado directamente en la BD: la compra se creó con `cantidad=1` y **cero filas** en `compra_acompanyants` para ella — el acompañante fantasma enviado en el body nunca se procesó ni se guardó. Interpreté "no debe exigirse ni aceptarse el campo" como "no se usa en absoluto cuando cantidad=1", no como "hay que rechazar la petición si llega" — rechazar penalizaría a un cliente antiguo/con caché que todavía mande el campo desde una versión previa del formulario, sin ningún beneficio real (el dato sobrante simplemente no tiene ningún efecto).
6. **`npm test`** — **50/50 pasan** (41 preexistentes + 9 nuevos de `validarAcompanyants`), ejecutado contra `db-test` arriba.
7. **Limpieza** — evento, compras y acompañantes de prueba eliminados; confirmado por SQL directo que no queda ninguna fila (`eventos: 0, compras: 0, acompanyants: 0`) — la cascada `ON DELETE CASCADE` desde `compras` funcionó correctamente al eliminar el evento (que a su vez elimina sus compras, que a su vez eliminan sus acompañantes).

---

## SQL que se aplicará a producción al desplegar

```sql
CREATE TABLE IF NOT EXISTS compra_acompanyants (
  id SERIAL PRIMARY KEY,
  compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compra_acompanyants_compra ON compra_acompanyants(compra_id);

ALTER TABLE compra_acompanyants ENABLE ROW LEVEL SECURITY;
```

**Confirmado explícitamente, para que no haya dudas:** a diferencia de un `DROP COLUMN` (que `schema.sql` nunca ejecuta automáticamente porque el mecanismo de arranque solo hace `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`), una tabla **completamente nueva** con `CREATE TABLE IF NOT EXISTS` **sí se crea sola, automáticamente, en el próximo arranque del servidor en producción** — no hace falta ninguna acción manual aparte de desplegar el código. `server.js` llama a `db.aplicarSchema()` explícitamente antes de `app.listen()` (desde la tanda de desacoplo de arranque), así que el primer arranque tras el despliegue ya deja la tabla lista antes de aceptar ninguna petición.

---

## Nota para la siguiente tanda (frontend)

El backend ya exige y guarda los acompañantes cuando `cantidad > 1`, así que el checkout público actual (que hoy no envía `acompanyants` en absoluto) **empezará a fallar con "calen exactament N acompanyants"** en cuanto alguien compre más de 1 plaza, hasta que la siguiente tanda añada el formulario dinámico correspondiente. Es el estado esperado, no un bug — mismo patrón que ya se vio con `invitados` en la Tanda A de ponentes.
