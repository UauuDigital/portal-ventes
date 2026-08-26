# Repaso global — portal-ventes (Espai Econòmic)

Auditoría read-only del repositorio completo. Cinco frentes en paralelo (arquitectura, seguridad, calidad, datos/rendimiento, tooling) + consolidación. Ningún archivo del proyecto ha sido modificado; no se ha arrancado el servidor ni ejecutado el seed (ambos escriben en la BD real de Supabase).

---

## 1. Veredicto

1. El backend está mejor construido de lo esperable en un junior en solitario: capas limpias, sin dependencias circulares, SQL siempre parametrizada y decisiones de diseño acertadas (aforo calculado, importes en céntimos, auditoría en `historial`).
2. Pero **no es apto para producción tal cual**: hay un bypass de autenticación que concede rol `admin` con usuario y contraseña vacíos si faltan las variables de entorno.
3. A eso se suman una fuga del `edit_token` de cualquier comprador hacia el rol `viewer`, y dos vías distintas de sobreventa de entradas — una determinista, no una condición de carrera rara.
4. El resto es deuda técnica normal y en su mayoría asumible: frontend sin sistema de módulos, lógica duplicada, y cero tests sobre el camino de pago.
5. Con los cuatro bloqueantes resueltos (todos esfuerzo S, ~1-2 días) el portal es defendible en producción para el volumen esperado.

---

## 2. Recuento de hallazgos

| Severidad | Nº | Dónde están en este informe |
|---|---|---|
| CRÍTICO | 4 | Enumerados uno a uno en §3 (#1–#4) |
| ALTO | 12 | 6 en §3 (#5–#10) + 6 en §4 |
| MEDIO | ~18 | Los representativos en §6, etiquetados |
| BAJO | ~14 | Los representativos en §6, etiquetados |

Cifras tras deduplicar: la sobreventa por falta de transacción la reportaron 3 de los 5 frentes por separado, y el bypass de auth 2 de 5.

**Los recuentos de CRÍTICO y ALTO son exactos y todos están enumerados abajo.** Los de MEDIO y BAJO son aproximados a propósito: el informe recoge los representativos y agrupa el resto (variantes del mismo patrón de duplicación, inconsistencias menores de presentación) en lugar de inflar la lista con entradas que dirían lo mismo.

---

## 3. Top 10 por severidad

### 1. CRÍTICO — Bypass de autenticación con credenciales vacías
`controllers/authController.js:16-18` · **Esfuerzo: S**

`safeEqual('', '')` devuelve `true` (dos buffers de longitud 0; `crypto.timingSafeEqual` no lanza, devuelve `true` — verificado ejecutándolo). Si `ADMIN_USER`/`ADMIN_PASS` no están definidas en el entorno, `process.env.ADMIN_USER || ''` se convierte en `''`, y un `POST /admin/login` con ambos campos vacíos autentica como **admin**.

Es el único secreto del proyecto que falla *abierto*: `DATABASE_URL` lanza excepción si falta (`config/db.js:5`), `SESSION_SECRET` también (`utils/sessionCookie.js:7`), pero las credenciales de admin no validan nada al arrancar. Un deploy nuevo en Plesk con esas dos variables olvidadas queda abierto de par en par, sin un solo error en los logs.

**Fix:** validar en el arranque que `ADMIN_USER`/`ADMIN_PASS` existen y no están vacías, y hacer que `safeEqual` devuelva `false` ante longitud 0.

### 2. CRÍTICO — `edit_token` de cualquier compra expuesto al rol `viewer`
`controllers/adminController.js:278-282` · **Esfuerzo: S**

Cadena completa, verificada:
- `Compra.create` registra en el historial `dades_despres: compra` — la fila entera, incluido `edit_token` (`models/Compra.js:52`).
- `Historial.llistar` hace `SELECT h.*` (`models/Historial.js:34`).
- `llistarHistorial` devuelve las entradas tal cual, sin filtrar.
- La ruta es accesible por `viewer` (`routes/adminRoutes.js:32`).

`llistarCompresEvento` sí elimina explícitamente `edit_token` (`adminController.js:256`), lo que demuestra que se identificó el riesgo — pero la protección se quedó a medias. Cualquier usuario `viewer` puede leer el enlace de edición de datos de todos los compradores y modificar sus respuestas.

**Fix:** excluir `edit_token` en `Compra.create` antes de pasar el objeto al historial (o filtrar en `llistarHistorial`).

### 3. CRÍTICO — Sobreventa determinista por desfase de ventanas temporales
`models/Compra.js:19` vs `controllers/stripeController.js:10` · **Esfuerzo: S**

`RESERVA_MINUTES` por defecto es **15**. `EXPIRA_MINUTS` es `Math.max(30, ...)` porque Stripe exige un mínimo de 30. Es decir: `cantidadOcupada()` deja de contar una reserva `pendiente` a partir del minuto 15, mientras la sesión de Stripe sigue viva y pagable hasta el minuto 30.

No hace falta concurrencia ni mala suerte: un comprador lento libera su plaza en el minuto 15, otro la compra, y el primero paga igualmente en el minuto 20. `marcarPagado` no comprueba aforo. **Hay una ventana de 15 minutos en cada checkout.**

El comentario de `Compra.js:16-18` reconoce el riesgo como "puntual", pero con los valores por defecto no lo es.

**Fix:** `RESERVA_MINUTES` debe ser ≥ `CHECKOUT_EXPIRES_MINUTES`, o bien `marcarPagado` debe revalidar aforo y alertar en caso de sobreventa.

### 4. CRÍTICO — Comprobación de aforo e inserción sin transacción
`controllers/stripeController.js:93-111` · **Esfuerzo: M**

`Compra.cantidadOcupada()` → comparación → `Compra.create()`, sin transacción, sin `SELECT ... FOR UPDATE` y sin constraint que lo respalde. Dos peticiones concurrentes por la última plaza pasan ambas la validación.

La causa raíz es estructural: `config/db.js` expone `.get/.all/.run` sobre `pool.query` suelto y **no ofrece ninguna primitiva transaccional** en todo el repositorio. Ningún desarrollador podría arreglarlo sin tocar primero la capa de acceso a datos.

**Fix:** añadir soporte de transacción en `config/db.js` y envolver el bloque; o mover la comprobación a un `INSERT ... SELECT ... WHERE` atómico.

### 5. ALTO — `POST /admin/login` sin rate limiting
`routes/adminRoutes.js:21` · **Esfuerzo: S**

`checkoutLimiter` existe y está bien hecho, pero solo se cablea a `/api/checkout/crear` (`routes/publicRoutes.js:12`). El endpoint de credenciales admite fuerza bruta ilimitada. Agrava directamente el hallazgo #1: un atacante puede probar vacío/vacío sin ningún freno.

### 6. ALTO — El email de confirmación se puede perder para siempre
`utils/mailer.js:116-118` + `controllers/stripeController.js:212-224` · **Esfuerzo: S**

`enviarEmailConfirmacio` se traga cualquier error de Resend (best-effort, solo `console.error`). El webhook responde 200 igualmente, Stripe no reintenta, y el guard `compra.estado_pago !== 'pagado'` impide que un redelivery manual desde el Dashboard vuelva a intentarlo.

Un glitch transitorio de Resend deja al comprador sin entrada, sin aviso interno, y sin ninguna vía de reenvío (`enviarEmailDePrueba` solo manda datos de ejemplo). Es pérdida de servicio silenciosa en el camino que más importa.

### 7. ALTO — Idempotencia del webhook no atómica
`controllers/stripeController.js:211-223` · **Esfuerzo: S**

Check-then-act (`leer estado_pago` → `marcarPagado`) sin UPDATE condicional ni deduplicación por `event.id`. Además el handler espera **dos** llamadas a Resend antes de responder, lo que alarga la ventana lo suficiente como para que Stripe dispare un redelivery mientras el primero sigue en curso → doble email.

**Fix:** `UPDATE compras SET estado_pago='pagado' WHERE id=$1 AND estado_pago<>'pagado' RETURNING id`, enviar emails solo si `rowCount===1`.

### 8. ALTO — TLS de la base de datos sin validar
`config/db.js:11` · **Esfuerzo: M**

`ssl: { rejectUnauthorized: false }` desactiva la validación del certificado del servidor Postgres. La conexión queda expuesta a un MITM que presente un certificado falso. Debería validarse contra el CA de Supabase.

### 9. ALTO — Cero cobertura sobre el camino crítico
`tests/` · **Esfuerzo: L**

12 tests, todos pasan, pero cubren únicamente `utils/csv.js` y `utils/sessionCookie.js` — los dos únicos archivos del repo sin efectos secundarios al hacer `require`. Sin cobertura: webhook de Stripe, cálculo de aforo, `requireRole`/separación admin-viewer, y `utils/camposFormulario.js` (129 líneas de validación **totalmente pura**, el test más barato de escribir de todo el proyecto).

La razón estructural: `config/db.js` aplica `schema.sql` al cargarse el módulo, y `stripeController.js:7` instancia Stripe a nivel de módulo. Cualquier test que haga `require` de un modelo o controller toca la BD. **No es pereza, es un problema de diseño de arranque.**

### 10. ALTO — `public/js/admin.js`: 1.230 líneas con enrutado por olfateo de DOM
`public/js/admin.js:196` · **Esfuerzo: M**

Todo el panel se carga entero en todas las páginas admin y decide qué bloque ejecutar comprobando si existen ciertos IDs (`document.getElementById('btn-logout') && !document.getElementById('form-evento-editar')`). Renombrar un ID rompe un bloque en silencio. Además `admin-historial.js` consume `apiFetch`, `escapeHtml`, `formatEuros` y `formatData` como globales implícitas definidas en `admin.js`, acopladas solo por el orden de las etiquetas `<script>`.

---

## 4. Otros hallazgos ALTO (fuera del top 10)

Reales y verificados, pero por debajo de los diez anteriores en impacto o urgencia:

- **ALTO — Inyección HTML en el email interno de facturación.** `utils/mailer.js:170-193` interpola `nombre_fiscal`, `direccion_fiscal` y `nombre_comprador` sin escapar en el HTML que se envía a `digital@uauu.cat`. `validarBody` no limita longitud ni caracteres en esos campos libres. Un comprador puede inyectar marcado o enlaces en un correo que lee el personal interno. **Esfuerzo: S.**
- **ALTO — Sin cabeceras de seguridad.** `server.js` no monta `helmet` ni equivalente: no hay CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` ni HSTS. Sin CSP no hay mitigación de segunda línea ante una futura XSS, y el propio login de admin es incrustable en un iframe. **Esfuerzo: M.**
- **ALTO — Mensajes de error técnicos mostrados al comprador.** `stripeController.js:31-58` genera `'nombre_comprador invàlid'`, `'telefono invàlid'`, `'cantidad invàlida'`, `'nif invàlid'` y `checkout.js:413` los pinta tal cual (`data.detalls.join(', ')`). El identificador interno en snake_case acaba en la pantalla del cliente final, contra la regla explícita del propio proyecto. **Esfuerzo: M.**
- **ALTO — Llamada a API externa sin timeout en el camino de escritura.** `utils/traduccio.js:14` hace `fetch` a MyMemory sin `AbortSignal`, y `adminController.js:109-120` la espera al crear o editar un evento. Si el servicio externo cuelga, la petición del admin cuelga con él. **Esfuerzo: S.**
- **ALTO — Sin linter, formatter, CI ni pre-commit hooks.** Cero `devDependencies`. En un proyecto tocado por un junior, nada detecta un error de sintaxis, un import roto o un `console.log` olvidado antes del push — y el push va a un servidor cuyo arranque aplica `schema.sql` contra Supabase. **Esfuerzo: M.**
- **ALTO — Coste transversal de añadir un idioma.** Conviven dos mecanismos de traducción independientes: diccionario estático en cliente (`i18n.js`, 523 líneas) para la interfaz, y columnas `_es`/`_en` rellenadas vía API externa (`utils/traduccio.js`) para el contenido. Un cuarto idioma obliga a tocar `schema.sql`, dos controllers, el diccionario y `admin.js` a la vez. **Esfuerzo: L.**

---

## 5. Bloqueantes

Antes de nada, y en este orden:

1. **Auth bypass con credenciales vacías** (#1) — S. Es el riesgo más grave y el más barato de arreglar.
2. **Fuga de `edit_token` por el historial** (#2) — S. Un `delete` antes de registrar.
3. **`RESERVA_MINUTES` < expiración de Stripe** (#3) — S. Es un cambio de configuración con revalidación de aforo al marcar pagado.
4. **Rate limiting en `/admin/login`** (#5) — S. El middleware ya existe, solo hay que cablearlo.

Los cuatro son esfuerzo S. La transacción del aforo (#4) es M y puede ir en una segunda tanda, porque su ventana real es de milisegundos frente a los 15 minutos del #3.

---

## 6. Deuda técnica asumible

Documentable y convivible mientras el volumen sea el esperado:

- **MEDIO** · **Sin paginación** en `Compra.listByEvento` ni en la tabla del admin. Correcto para eventos de decenas o cientos de entradas; se rompe con miles.
- **MEDIO** · **N+1 en `cantidadOcupada`** — una query por evento en `llistarEventos` y `getEventosActius`. Con pocos eventos activos es irrelevante; resolvible con un `GROUP BY`.
- **MEDIO** · **`eventos.fecha` y `fecha_limite_compra` son TEXT, no TIMESTAMPTZ.** Las comparaciones son lexicográficas y solo funcionan porque todas las escrituras pasan por `toISOString()`. Frágil ante una edición manual en Supabase, pero estable hoy. Cambiarlo requiere DDL manual fuera del flujo auto-aplicado (esfuerzo L).
- **MEDIO** · **`escapeHtml`/`escapeAttr` duplicadas literalmente 4 veces** (`admin.js`, `checkout.js`, `mis-datos.js`, `success.js`). Sin build step, se resuelve con un `<script src="/js/dom-utils.js">` común.
- **MEDIO** · **Lógica de campos dinámicos triplicada**: backend (`utils/camposFormulario.js`, correcta), `checkout.js` y `mis-datos.js`, cada una con su copia divergente.
- **MEDIO** · **`stripe ^16.8.0`** frente a 22.x actual (6 majors), sin `apiVersion` explícita en `Stripe(...)`. `npm audit`: **0 vulnerabilidades** en 92 dependencias.
- **MEDIO** · **Duración de sesión definida por duplicado**: `VUIT_HORES_MS` (`authController.js:4`) y `HORES_EXPIRACIO` (`sessionCookie.js:3`). Cambiar uno sin el otro los desincroniza en silencio.
- **BAJO** · **`digital@uauu.cat` hardcodeada** como destinatario de la notificación de factura (`mailer.js:190`) — el propio commit la marcó como "temporal".
- **BAJO** · **`STRIPE_PUBLISHABLE_KEY`** documentada en `.env.example` y README pero **no se usa en ninguna parte** (el checkout es 100% redirección de servidor). **`PGSSLMODE`** sí se usa (`db.js:11`) pero no está documentada.
- **BAJO** · **`historial` sin purga ni retención**, guardando snapshots JSON completos de cada fila.
- **BAJO** · **Cache-busting manual `?v=N`** en cada `<script>`, incrementado a mano.
- **BAJO** · **`rolSessio`** (`authMiddleware.js:43`) exportada y nunca importada: código muerto.
- **BAJO** · **Estado `reembolsado`** declarado en el esquema pero inalcanzable: no hay handler de `charge.refunded` ni vía manual.
- **BAJO** · **Sin tipado ni JSDoc** en ~2.500 líneas de backend.
- **INFORMATIVO** · **Historial de git limpio**: 76 commits, ningún `.env`, `certificat/`, `.superpowers/` ni `GLOBAL_CLAUDE.md` versionado nunca. El commit `8128298` ("completa .gitignore") solo añadió `/dist` y `/build`; `.env` estaba ignorado desde el primer commit. **No hay secretos filtrados.** Los mensajes son descriptivos pero largos y mezclan cambios no relacionados, lo que dificulta `git bisect`.

---

## 7. Lo que está bien hecho

1. **Aforo calculado, no almacenado** (`aforo_total` − ocupadas), con ventana temporal para reservas abandonadas. Decisión correcta y bien razonada en los comentarios.
2. **Arquitectura backend en capas estricta**, sin dependencias circulares: `routes → controllers → models → db`, con `Historial` como único módulo transversal escrito desde los modelos, nunca desde los controllers.
3. **Toda la SQL está parametrizada.** No hay una sola interpolación de strings en los modelos. Cero riesgo de inyección.
4. **Firma del webhook de Stripe verificada siempre**, con el body en crudo y registrado antes del parser JSON global (`server.js:16`).
5. **Los comentarios explican el *porqué*, no el *qué*** — y varios documentan honestamente riesgos asumidos en lugar de esconderlos.

---

## 8. Mapa del proyecto

**Entrada:** `server.js` (48 líneas) monta, en este orden deliberado: `webhookRoutes` (antes de `express.json()`, para preservar el body crudo de Stripe), luego `express.json()`, `adminRoutes`, la excepción de `/admin/login.html`, el estático protegido de `/admin`, el estático público, y `publicRoutes`.

**Datos:** `config/db.js` es una capa fina sobre `pg` que **emula la API de `node:sqlite`** (`.prepare().get/.all/.run`) — residuo de una migración desde SQLite. Traduce parámetros `@nombre` y `?` a `$1, $2`. Aplica `config/schema.sql` **al cargarse el módulo**, así que cualquier `require` de un modelo toca la BD. No expone transacciones.

**Esquema** (`config/schema.sql`, 85 líneas, sin migraciones): `eventos`, `compras`, `historial`. Crecimiento por `ALTER TABLE ADD COLUMN IF NOT EXISTS` acumulados. RLS activado en las tres tablas (solo protege el acceso vía PostgREST; la app entra por Postgres directo). Índices en `compras(evento_id)`, `compras(stripe_checkout_session_id)` (no único), `compras(edit_token)` (único parcial) e `historial(evento_id, created_at)`.

**Modelos:** `Evento.js` (190), `Compra.js` (178), `Historial.js` (63). SQL cruda, siempre parametrizada. `Evento.tancarExpirats()` se invoca desde `getById`, `getActivo`, `listActivos` y `listAll`, convirtiendo casi toda lectura en escritura potencial.

**Controllers:** `stripeController` (267 — checkout + webhook, el núcleo del negocio), `adminController` (344 — CRUD, CSV, historial), `eventoController` (103 — API pública multi-idioma), `authController` (47), `misDatosController` (57 — edición por token opaco, sin login).

**Auth:** cookie `admin_session` HMAC-SHA256 con payload `{usuari, rol, exp}`, 8h, `httpOnly` + `sameSite: strict` + `secure` en producción. `requireRole('admin','viewer')` para lectura, `requireRole('admin')` para escritura. **Las rutas están correctamente protegidas en el backend** — la separación de roles no depende del frontend.

**Frontend:** sin sistema de módulos, todo globales por orden de `<script>`. Público: `checkout.js` (446), `i18n.js` (523, diccionario ca/es/en), `mis-datos.js`, `success.js`, `legal-modal.js`. Admin: `admin.js` (1.230) + `admin-historial.js` (167). CSS: el público sí está modularizado vía `@import` en `style.css`; el admin es un monolito de 1.568 líneas.

**Traducción — dos mecanismos independientes:** diccionario estático en cliente (`i18n.js`) para la interfaz, y columnas `nombre_es/_en`, `descripcion_es/_en` rellenadas llamando a la API externa MyMemory (`utils/traduccio.js`, sin timeout) para el contenido del admin. Añadir un idioma obliga a tocar esquema, backend y frontend a la vez.

---

## 9. Puntos que requieren tu criterio humano

1. **La puerta trasera del panel admin.** Escribir literalmente "admin" en el campo *nombre del comprador* del formulario público redirige a `/admin/login.html` (`public/js/checkout.js:373-379`). ¿Es un atajo deliberado que quieres conservar, o un resto que debería ser un enlace normal? *(Nota: no es un agujero — `/admin` está protegido igualmente en el backend. Es una decisión de producto, no de seguridad. Pero atrapa a cualquier comprador que se llame Admin.)*

2. **`RESERVA_MINUTES` = 15.** ¿Fue un valor elegido a conciencia sabiendo que Stripe impone 30 minutos mínimo, o se fijó sin cruzarlo? La respuesta cambia si el fix es "subirlo a 30" o "revalidar aforo al marcar pagado".

3. **Sobreventa: ¿cuál es la política de negocio?** El código asume que se resuelve manualmente ("s'hauria de resoldre manualment si passa"). ¿Es aceptable para Espai Econòmic vender una entrada de más ocasionalmente, o el aforo es duro? De ahí depende si el fix #4 es M o L.

4. **La tabla de compras del admin no muestra `estado_pago`** en ninguna columna — solo se infiere por la presencia del botón "Cancelar". Sí se exporta al CSV. ¿Omisión intencionada o funcionalidad pendiente?

5. **`historial` está en catalán** (`tipus_entitat`, `accio`, `dades_abans`...) mientras `eventos`/`compras` están en castellano, contra la convención que documenta CLAUDE.md. ¿Decisión consciente que hay que documentar como segunda excepción, o deriva accidental? Renombrar ahora es esfuerzo L.

6. **Estado `reembolsado`**: declarado en el esquema, inalcanzable en el código. ¿Se implementa el handler de `charge.refunded` o se elimina del enum?

7. **`digital@uauu.cat`** como destinatario de las notificaciones de factura: ¿es la dirección definitiva (y entonces debería ser env var) o sigue siendo temporal?

8. **Alcance de la conformidad con el CLAUDE.md sobre errores de usuario.** La regla dice que nunca deben ser técnicos, pero el comprador ve literalmente `"nombre_comprador invàlid"`, `"telefono invàlid"`, `"cantidad invàlida"` (`stripeController.js:31-58` → `checkout.js:413`). ¿Se traducen todos a lenguaje natural, o se acepta la deuda en el panel interno y solo se arregla el público?

9. **Documentación desactualizada — decide qué se corrige:** el README afirma que el repo está "**sense cap commit**" (hay 76), lista como pendiente el "enviament de l'email de confirmació" (implementado hace ~30 commits, `utils/mailer.js`, 199 líneas), y su sección "Model de dades" omite `campos_formulario`, `respuestas_campos`, `edit_token`, `email_asunto`, `email_html` y toda la tabla `historial`. CLAUDE.md sitúa `i18n.js` en `utils/` cuando está en `public/js/`, y su bloque de estructura omite `misDatosController.js`, `models/Historial.js` y `utils/camposFormulario.js`. Además, el plan `docs/superpowers/plans/2026-07-13-panell-admin.md` declara el stack como `node:sqlite` — el proyecto es Postgres desde hace tiempo. ¿Se actualizan los planes históricos o se marcan como documentos de archivo?

---

## Anexo — Documentación existente

| Documento | Estado |
|---|---|
| `README.md` (8,4 KB) | Bien escrito y útil, pero **desactualizado en tres puntos concretos** (ver criterio humano #9). La sección de seguridad y la tabla de variables de entorno sí son fiables. |
| `CLAUDE.md` (3,4 KB) | Actualizado y valioso: documenta excepciones de naming, notas de dominio y el porqué de `mis-datos.html` monoidioma. Dos imprecisiones menores de estructura. |
| `docs/superpowers/plans/*.md` (2, ~105 KB) | Planes de implementación históricos, no mantenidos. El de julio declara `node:sqlite`. Valor arqueológico, no de referencia. |
| `docs/superpowers/specs/*.md` (2) | Especificaciones de diseño previas. La del formulario personalizado sigue siendo la mejor descripción del modelo JSONB. |
| `public/fonts/README.md` | Explica cómo obtener la tipografía Ogg (licencia propia, no descargable). Los archivos no están; cae a Georgia. Correcto. |
| **Sin documentar** | El procedimiento de despliegue en Plesk. El runbook de qué hacer si Resend falla o si se produce sobreventa. La relación entre `RESERVA_MINUTES` y la expiración de Stripe. La existencia de la tabla `historial` y su política de retención. |

## Anexo — Salidas reales verificadas

```
npm test  →  tests 12 · pass 12 · fail 0
npm audit →  0 vulnerabilidades (92 dependencias prod, 0 dev)
```

**No verificado** (requeriría escribir en la BD real o llamar a APIs externas de producción): arranque del servidor, `npm run seed`, esquema realmente desplegado en Supabase frente a `schema.sql`, comportamiento en vivo del webhook, y el volumen real de datos en producción — si ya es grande, los hallazgos de paginación y N+1 suben de severidad.

No existe `.github/`, `tsconfig.json`, configuración de ESLint/Prettier, Dockerfile ni build step. La ausencia es el hallazgo, no un fallo de búsqueda.
