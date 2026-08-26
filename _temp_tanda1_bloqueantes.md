# Tanda 1 — Bloqueantes de seguridad y aforo

Correcciones aplicadas sobre los cuatro bloqueantes de `_temp_repaso_proyecto_junior.md` §5. Nada más se ha tocado. Sin commits — todo queda en el working tree. Ni el servidor ni `npm run seed` se han ejecutado en ningún momento.

---

## FIX 1 — Bypass de autenticación con credenciales vacías

**Archivos:** `controllers/authController.js`, `.env.example`

- `safeEqual(a, b)` ahora devuelve `false` en cuanto cualquiera de los dos buffers tiene longitud 0, antes de llegar a `timingSafeEqual` (que trataba dos buffers vacíos como iguales).
- Añadida una validación de arranque a nivel de módulo: si `ADMIN_USER` o `ADMIN_PASS` faltan o están vacías, `authController.js` lanza una excepción al cargarse — mismo patrón que `config/db.js:5` con `DATABASE_URL`, que también falla al `require`. Como `adminRoutes.js` (y por tanto `authController.js`) se carga al arrancar `server.js`, esto bloquea el arranque completo del proceso, no solo el primer intento de login.
- `.env.example` documenta ambas variables como obligatorias.

**Por qué las dos cosas y no solo una:** la validación de arranque es la defensa principal (nunca debería llegar a producción sin estas variables). El fix de `safeEqual` es defensa en profundidad — cierra el mismo agujero aunque alguien defina `ADMIN_PASS=""` explícitamente (string vacío no vacío-por-ausencia, que la validación de arranque también captura porque comprueba falsy, pero conviene no depender de un único punto de control para algo tan crítico).

## FIX 2 — Fuga de `edit_token` hacia el rol `viewer`

**Archivo:** `models/Compra.js` (función `create`)

Antes de registrar la compra en `historial`, se excluye `edit_token` del objeto guardado (`dades_despres`). El objeto que `Compra.create` devuelve al llamante sigue teniendo `edit_token` completo — sigue haciendo falta en el flujo de compra normal (aunque, comprobado, ningún llamante actual lo usa inmediatamente tras la creación; lo usa `utils/mailer.js` a partir de una lectura fresca de la compra vía `findBySessionId`, no del valor de retorno de `create`).

**Revisión del resto de la cadena:** comprobé todos los demás puntos donde `Compra.js`/`Evento.js` pasan objetos completos a `Historial.registrar` (`marcarPagado`, `marcarCancelado`, `eliminarPerEvento`, `Evento.create`, `Evento.update`, `Evento.remove`). Ninguno más mete filas de `compras` completas al historial — todos usan subconjuntos de campos (`{ estado_pago }`, `{ total }`) o son filas de `eventos`, que no tiene `edit_token`. No hacía falta tocar nada más.

## FIX 3 — Sobreventa determinista por desfase de ventanas

**Archivos nuevos:** `utils/checkoutConfig.js`
**Archivos modificados:** `controllers/stripeController.js`, `models/Compra.js`, `.env.example`

**a) Ventana derivada, no desincronizable.** Extraje el cálculo `Math.max(30, CHECKOUT_EXPIRES_MINUTES)` (antes solo en `stripeController.js`) a `utils/checkoutConfig.js`, que exporta `EXPIRA_MINUTS`. Tanto `stripeController.js` como `models/Compra.js` importan ese único valor. `MINUTS_RESERVA` en `Compra.js` pasó de `parseInt(process.env.RESERVA_MINUTES || '15', 10)` a `Math.max(EXPIRA_MINUTS, parseInt(process.env.RESERVA_MINUTES || '15', 10))`: con los valores por defecto del repo (`RESERVA_MINUTES=15`, `CHECKOUT_EXPIRES_MINUTES=30`) esto sube efectivamente la reserva a 30 minutos, cerrando la ventana de 15 minutos que permitía la sobreventa determinista. Verificado en aislado (sin tocar la BD): con `RESERVA_MINUTES=15`/`EXPIRA_MINUTS=30` → 30; con `RESERVA_MINUTES` explícito por encima del mínimo, se respeta ese valor mayor; nunca baja de `EXPIRA_MINUTS`.

**Decisión que tomé por mi cuenta:** en vez de duplicar la fórmula `Math.max(30, ...)` en los dos archivos (que es exactamente el tipo de duplicación que causó el desfase original), creé el módulo compartido `utils/checkoutConfig.js`. Es la forma mínima de garantizar la invariante "siempre ≥" sin crear una dependencia circular (`Compra.js` no puede importar `stripeController.js`, que a su vez importa `Compra.js`). Si prefieres que quede todo dentro de `Compra.js` sin el archivo nuevo, es un cambio de cinco minutos, pero perderíamos la garantía de que ambos valores no puedan volver a desincronizarse.

**b) Detección de sobreventa (no bloqueo).** `Compra.marcarPagado` ahora llama a una función nueva `comprovarSobrevenda(eventoId)` justo después de marcar el pago: relee el aforo ocupado y el `aforo_total` del evento, y si el primero supera al segundo, hace `console.error` y registra una entrada en `historial` (`tipus_entitat: 'evento'`, `accio: 'sobrevenda'`, `origen: 'automatic'`) con el detalle de ocupación. El pago **nunca** se rechaza ni se revierte — Stripe ya ha cobrado; el webhook sigue devolviendo 200 igual que antes.

**c) Comentario actualizado.** El comentario de `Compra.js` sobre `MINUTS_RESERVA` ya no describe el riesgo antiguo (desfase temporal, ahora cerrado por construcción); explica que el valor se deriva con `Math.max` precisamente para no poder desincronizarse, y el comentario nuevo sobre `comprovarSobrevenda` señala el riesgo residual real: la comprobación de aforo sin transacción en `crearCheckoutSession` (bloqueante #4 del informe, transacciones — **fuera de esta tanda a propósito**, tal como pediste).

## FIX 4 — Rate limiting en `/admin/login`

**Archivos:** `middleware/rateLimiter.js`, `routes/adminRoutes.js`

Nuevo `loginLimiter` (10 peticiones / 15 minutos por IP) junto a `checkoutLimiter`, sin tocar este último ni su uso. Cableado en `routes/adminRoutes.js` como middleware de `POST /admin/login`, antes del propio `login`.

**Decisión que tomé por mi cuenta:** elegí 10 intentos en 15 minutos (más estricto que los 20 de `checkoutLimiter`, que protege una acción pública con tráfico legítimo alto). Es un valor de partida razonable para frenar fuerza bruta sin bloquear a un admin real que se equivoca de contraseña un par de veces; si el equipo interno comparte IP de oficina (NAT), podría convenir subirlo — lo dejo a tu criterio, es un solo número.

---

## Verificación

1. **`npm test`** → **17/17 tests pasan** (los 12 existentes + 5 nuevos de `safeEqual`). Salida completa en el chat.
2. **`safeEqual` en aislado** (`node -e`, sin BD): `safeEqual('', '')` → `false`; `safeEqual('secret', 'secret')` → `true`. Confirmado.
3. **Arranque sin credenciales** (`node -e "require('./controllers/authController')"`, sin `ADMIN_USER`/`ADMIN_PASS`, sin tocar la BD porque `authController.js` no importa `config/db.js`): lanza `Error: Falten ADMIN_USER/ADMIN_PASS a l'entorn: calen credencials d'administrador no buides per arrencar.` y termina con código de salida 1. Repetido también con `ADMIN_PASS=''` (vacía pero definida): mismo resultado. Con credenciales definidas, el módulo carga sin error.
4. **Tests añadidos:** `tests/authController.test.js`, 5 casos sobre `safeEqual` (igualdad, distintas mismo largo, distinto largo, ambas vacías, una vacía). No he podido —ni lo he intentado— añadir tests para el fix de `RESERVA_MINUTES`/`marcarPagado`/`comprovarSobrevenda` ni para el rate limiter, porque requieren `require` de `models/Compra.js` (que carga `config/db.js`, que aplica el schema contra la BD real al importarse) o levantar el servidor Express. Ese problema estructural es, tal como dijiste, de otra tanda. Sí verifiqué la fórmula de `MINUTS_RESERVA` en aislado, replicándola en un script suelto sin importar `Compra.js` (ver diff/transcripción de comandos).
5. **`node --check`** en los 7 archivos tocados/nuevos: todos parsean correctamente. **Esto solo comprueba sintaxis, no que el grafo de módulos cargue** — lo señalo porque es una distinción real: ningún test de la suite hace `require` de `models/Compra.js` (ninguno lo hacía antes tampoco), así que FIX 2 y FIX 3 nunca se han ejecutado de verdad en esta sesión. Verificación adicional que sí hice para compensarlo:
   - Confirmé por lectura que no hay dependencia circular: `models/Evento.js` y `models/Historial.js` solo requieren `config/db.js` (y `Evento.js` requiere `Historial.js`); ninguno de los dos requiere `Compra.js`, así que `Compra.js` → `Evento.js` es segura.
   - Intenté cargar `models/Compra.js` de verdad con un `DATABASE_URL` inalcanzable (`127.0.0.1:1`, puerto que rechaza la conexión al instante, sin tocar ninguna BD real) para que `require` resuelva sin llegar a aplicar el schema. **No lo pude completar**: este checkout no tiene `node_modules/` instalado (`pg` no está disponible), así que cualquier `require` de `config/db.js` falla en `MODULE_NOT_FOUND` antes de llegar siquiera a intentar la conexión — no es un problema de mis cambios, es que no hay dependencias instaladas en este directorio. Instalarlas (`npm install`) no estaba autorizado en esta tanda y no lo he hecho.
   - Como compensación until ahí, hice una revisión estática de cada identificador nuevo usado en `Compra.js` (`EXPIRA_MINUTS`, `Evento.getById`, `comprovarSobrevenda`, `cantidadOcupada`, `MINUTS_RESERVA`) contra dónde se define cada uno — todos casan, incluyendo que `cantidadOcupada` (declaración `function`, hoisted) se puede llamar desde `comprovarSobrevenda` aunque esté definida más abajo en el archivo.
   - **Actualización (ver "Re-verificación en caliente" más abajo)**: esto ya no queda pendiente. Con `node_modules` instalado y un Postgres local, `models/Compra.js` cargó y se ejecutó de verdad — `Compra.create`, `Compra.marcarPagado` y `comprovarSobrevenda` corrieron contra datos reales sin errores.
6. Diff completo guardado en `_temp_diff_tanda1.txt` (raíz).

---

## Decisiones que tomé por mi cuenta (para tu revisión)

- **Módulo compartido `utils/checkoutConfig.js`** en vez de duplicar la fórmula — ver FIX 3a. Es la única pieza de este diff que no estaba explícitamente en la lista como "archivo nuevo", pero es el mecanismo mínimo para cumplir el propio enunciado del fix ("que sea SIEMPRE ≥, no un valor suelto que pueda desincronizarse").
- **`accio: 'sobrevenda'`** es un valor nuevo en la columna `historial.accio`. No hay `CHECK` constraint en `schema.sql` que lo impida (es `TEXT` libre), así que no hizo falta tocar el esquema. Pero **no lo he propagado al frontend**: `public/js/admin-historial.js:135` usa `ETIQUETES_ACCIO[entrada.accio] || entrada.accio`, así que esta nueva entrada se verá en el panel de historial con el texto crudo `sobrevenda` en vez de una etiqueta traducida/con color. Lo dejo así porque tocar frontend no estaba en el encargo de esta tanda.
- **`loginLimiter`: 10/15min** — número de partida razonable, explicado en FIX 4. Un solo valor a ajustar si no te convence.
- **No añadí `apiVersion` a Stripe ni toqué nada de `stripeController.js` más allá del import de `EXPIRA_MINUTS`** — no estaba en la lista.

---

## Re-verificación en caliente

Todo lo de esta sección se ejecutó contra un Postgres **local** en Docker (`docker-compose.local.yml`, puerto `55432`) y `.env.local` (credenciales dummy, Stripe/Resend vacíos). En ningún momento se ha tocado `DATABASE_URL` de Supabase ni claves live de Stripe. Sin commits.

### Entorno montado

- `docker-compose.local.yml` (nuevo, raíz): Postgres 15 en contenedor propio, puerto `55432` (el 5432 y el 3000 estaban libres, no hizo falta cambiar el del servidor), volumen con nombre propio, `healthcheck` con `pg_isready`.
- `.env.local` (nuevo, no versionado): `DATABASE_URL` apuntando al contenedor, `PGSSLMODE=disable`, `ADMIN_USER`/`ADMIN_PASS`/`VIEWER_USER`/`VIEWER_PASS`/`SESSION_SECRET` dummy, `RESEND_API_KEY` vacía, y `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`/`STRIPE_WEBHOOK_SECRET` vacíos a la espera del paso 3.
- `.gitignore` actualizado: añadida la línea `.env.local` (antes solo cubría `.env`).
- Contenedor confirmado sano antes de seguir (`pg_isready` respondiendo, estado `healthy`).

### Paso 2 — Dependencias y arranque en seco

- `npm install` → 92 paquetes, 0 vulnerabilidades. **`package-lock.json` no se movió** (`git diff --stat package-lock.json` vacío).
- Arranque real (`node -r dotenv/config server.js dotenv_config_path=.env.local`) → log: `Portal Espai Econòmic escoltant a http://localhost:3000`, `/health` responde `{"ok":true}`.
- Confirmado por SQL directo contra el contenedor (`\dt`) que `schema.sql` creó `eventos`, `compras`, `historial` en el Postgres **local** — nunca en Supabase, porque `DATABASE_URL` nunca apuntó allí.
- **Hallazgo no anticipado, documentado honestamente**: dejar `STRIPE_SECRET_KEY` vacía (como pedía el paso 3) **no rompe el arranque** — `Stripe('')` no lanza en esta versión del SDK (`stripe@16.8.0`), instancia el cliente igualmente y solo fallaría al hacer una llamada real a la API. Mi resumen de la tanda 1 no llegó a comprobar esto (asumía, sin verificarlo, que sería como `Pool()`/`crearCookieSessio`); queda corregido aquí con la prueba real.
- **FIX1 en caliente**: con el servidor real (no un `node -e` aislado), vacié `ADMIN_PASS` en `.env.local` y reintenté arrancar → mismo error y `exit=1` que en la tanda 1 (`Falten ADMIN_USER/ADMIN_PASS...`). Repuesto el valor dummy y confirmado que vuelve a arrancar.

### Paso 4 — FIX2 y FIX3 en caliente (sin depender de Stripe)

Añadí temporalmente un `console.log` justo después de `MINUTS_RESERVA` en `models/Compra.js`, ejecuté un script de verificación (fuera del repo, en el scratchpad de la sesión) que crea datos de prueba reales contra el Postgres local, y **lo revertí inmediatamente después** — `git diff -- models/Compra.js` no contiene ningún rastro del log (confirmado).

Resultado real, contra la base de datos de verdad:

```
[VERIFICACIO-TEMPORAL] MINUTS_RESERVA = 30 (EXPIRA_MINUTS = 30 )

Evento de prova creat: id=1 aforo_total=1
Compra A id=1, Compra B id=2 (aforo_total=1, 2 pendents)
Sobrevenda detectada a "[TEST-VERIFICACIO] Esdeveniment de prova": 2/1 places ocupades
Sobrevenda detectada a "[TEST-VERIFICACIO] Esdeveniment de prova": 2/1 places ocupades
PASS — Compra A queda marcada pagado (el pagament no es bloqueja)
PASS — Compra B queda marcada pagado (el pagament no es bloqueja)
PASS — historial te una entrada amb accio='sobrevenda' per aquest esdeveniment
  -> descripcio: Sobrevenda detectada a "[TEST-VERIFICACIO] Esdeveniment de prova": 2/1 places ocupades
  -> dades_despres: {"ocupades":2,"aforo_total":1}
PASS — historial te l'entrada de creacio de la Compra A
PASS — dades_despres de la creacio de compra NO conte la clau edit_token
PASS — el valor de retorn de Compra.create() SI conte edit_token (nomes es filtra de historial)
```

- **`MINUTS_RESERVA` resuelve a 30** con los valores por defecto del repo (`RESERVA_MINUTES=15`, `CHECKOUT_EXPIRES_MINUTES=30`) — confirmado en ejecución real, cierra la ventana de 15 minutos del hallazgo CRÍTICO #3 del informe.
- **Sobreventa simulada** (evento con `aforo_total: 1`, dos compras `pendiente` para ese mismo evento — reproduciendo el estado al que llegaría la condición de carrera sin transacción, hallazgo CRÍTICO #4, que sigue sin resolver aparte) → al marcar ambas como pagadas con `Compra.marcarPagado`, **ambos pagos se confirmaron sin bloquearse** y `comprovarSobrevenda` escribió dos entradas en `historial` con `accio: 'sobrevenda'` (una por cada llamada a `marcarPagado`, comportamiento esperado y correcto — cada confirmación de pago revisa el estado del aforo en ese momento).
- **`edit_token` fuera del historial, confirmado con datos reales**: la entrada de `historial` para la creación de la Compra A no contiene la clave `edit_token` en `dades_despres` (verificado con `hasOwnProperty`, no solo "es falsy"). El valor que devuelve `Compra.create()` al llamante sí conserva `edit_token` completo, como se diseñó.
- **Limpieza verificada, no solo ejecutada**: tras el script, consulta directa a las tres tablas del Postgres local (`SELECT count(*)`) → `eventos: 0`, `compras: 0`, `historial: 0`.

### Paso 5 — FIX1 y FIX4 end-to-end (HTTP real)

Con el servidor real levantado contra el Postgres local:

- **FIX1**: `POST /admin/login` con `{"usuari":"","contrasenya":""}` → `HTTP 401 {"error":"credencials_invalides"}`. Antes de la tanda 1 esto habría devuelto `200 {"ok":true,"rol":"admin"}` con cookie de sesión — confirmado con un control positivo inmediatamente después: las mismas credenciales dummy correctas sí devuelven `200` y `Set-Cookie: admin_session=...`.
- **FIX4**: reinicié el servidor (para partir de un limitador en memoria a cero) y disparé 11 peticiones seguidas a `/admin/login` con credenciales incorrectas. Intentos 1–10 → `401 credencials_invalides` (autenticación evaluada con normalidad, cupo del limitador aún no agotado); **intento 11 → `429 {"error":"massa_peticions", ...}`**, cortado exactamente donde se configuró (`max: 10`).

### Estado final del entorno

- Contenedor `portal-ventes-db-1` sigue **arriba y sano** (`docker compose -f docker-compose.local.yml ps` → `Up ... (healthy)`), con las tres tablas vacías tras la limpieza.
- `.env.local` se conserva tal cual (con las credenciales dummy repuestas), listo para que el usuario meta sus claves de Stripe test.
- Para resetear el contenedor a cero en cualquier momento (datos de prueba, incluidas migraciones de schema si algo se corrompe): `docker compose -f docker-compose.local.yml down -v && docker compose -f docker-compose.local.yml up -d` (el `-v` borra el volumen; sin él, `down`/`up` conserva los datos).

---

## Paso 3 — Stripe: bloqueado a propósito, esperando al usuario

- **CLI de Stripe instalado**: no había Homebrew disponible sin arreglar antes las Command Line Tools de Xcode (`brew install` falló por eso), así que descargué el binario oficial precompilado desde el release de GitHub de `stripe/stripe-cli` (`v1.50.5`, `mac-os_arm64`) y lo instalé en `/opt/homebrew/bin/stripe` (ya en el `PATH`). Confirmado: `stripe --version` → `1.50.5`. No se ha tocado `package.json` para esto, tal como pedías.
- **Parado aquí, tal como se indicó.** Falta rellenar en `.env.local` (raíz del proyecto):
  ```
  STRIPE_SECRET_KEY=sk_test_...       # tu clave secreta de Stripe en modo TEST
  STRIPE_PUBLISHABLE_KEY=pk_test_...  # tu clave pública de Stripe en modo TEST
  ```
  (`STRIPE_WEBHOOK_SECRET` no hace falta tocarlo a mano: `stripe listen` te dará un `whsec_...` nuevo cuando lo arranques, ese es el que va ahí.)
- **Comando preparado, no ejecutado**, para cuando quieras arrancar la escucha del webhook (el servidor local corre en el puerto `3000`, según `.env.local`):
  ```
  stripe listen --forward-to localhost:3000/webhook/stripe
  ```

## Cosas que vi de camino y NO he tocado

- El propio bloqueante #4 del informe (transacción/lock en la comprobación de aforo de `crearCheckoutSession`) sigue sin resolver — `comprovarSobrevenda` es solo la red de detección que pediste, no el cierre de la condición de carrera. Sigue siendo M y sigue pendiente.
- `enviarEmailConfirmacio` en `utils/mailer.js` se sigue tragando errores de Resend en silencio (hallazgo ALTO #6 del informe) — no tocado.
- La idempotencia no atómica del webhook (hallazgo ALTO #7) — no tocada.
- `config/db.js:11` (`ssl: { rejectUnauthorized: false }`, hallazgo ALTO #8) — no tocado.
- Los mensajes de error técnicos que llegan al comprador (`'nombre_comprador invàlid'`, etc., §4 del informe) — no tocados.
- Cabeceras de seguridad (`helmet`, §4) — no tocadas.
