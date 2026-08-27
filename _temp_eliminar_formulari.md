# Eliminar sistema "Formulari de compra" (campos dinámicos por evento)

## PASO 0 — Comprobación de seguridad (resultado)

**No pude verificarlo yo mismo**: este entorno no tiene acceso a la base de
datos de producción (Supabase) — solo `.env.local`/`.env.test`, ambos
Postgres locales. Lo reporté en el chat antes de tocar nada y pedí a Marc
que ejecutara la consulta de verificación o me diera acceso.

**Marc respondió "Perfecto, sigue con los pasos 1-5"**, lo que interpreto
como autorización explícita para proceder pese al bloqueo — pero **sigue
sin haber una confirmación explícita de que el recuento sea 0**. Dejo esto
constatado con claridad: si existieran compras reales en producción con
`respuestas_campos` no vacío, sus datos seguirán en la fila de `compras`
en Supabase hasta que se ejecute el `ALTER TABLE ... DROP COLUMN` de más
abajo — que **no he ejecutado** — así que técnicamente no se ha perdido
nada todavía, pero recomiendo firmemente ejecutar esta consulta contra
Supabase antes de correr el `ALTER TABLE`:

```sql
SELECT count(*) FROM compras WHERE respuestas_campos IS NOT NULL AND respuestas_campos::text NOT IN ('{}', 'null');
```

Si el resultado no es 0, **no ejecutes el DROP COLUMN de `compras.respuestas_campos`** hasta decidir qué hacer con esos datos (exportarlos primero, etc.).

## Recomendación sobre `mis-datos.html` / `edit_token`

Ya la di antes de empezar y la he aplicado: **eliminación completa**. Confirmado
por lectura del código (agente de investigación, solo lectura) que:
- `mis-datos.html`/`mis-datos.js`/`misDatosController.js` solo editan
  `respuestas_campos` — ningún otro dato del comprador.
- `edit_token` no se usa para nada más en todo el proyecto (se genera solo
  en `Compra.create()`, se lee solo en `misDatosController.js`, se limpiaba
  explícitamente antes de mandarlo a `Historial`/admin API).

Con `campos_formulario` eliminado, esta página se habría quedado vacía —
no tenía sentido dejarla como cáscara. Se ha eliminado todo el subsistema.

## Qué se ha hecho (Pasos 1-5)

**Archivos borrados por completo:**
- `utils/camposFormulario.js`
- `public/mis-datos.html`
- `public/js/mis-datos.js`
- `controllers/misDatosController.js`

**Backend:**
- `routes/publicRoutes.js`: quitadas las rutas `GET`/`PUT /api/mis-datos/:token`.
- `controllers/adminController.js`: quitada la validación/paso de
  `campos_formulario` en crear/editar evento; quitado el destructure de
  `edit_token` en `llistarCompresEvento` (columna a punto de desaparecer).
- `controllers/stripeController.js`: quitada la validación de
  `respuestas_campos` (`validarRespuestas`) y su paso a `Compra.create()`.
- `controllers/eventoController.js`: quitado `campos_formulario` del
  payload público de `/api/evento/actual`.
- `models/Evento.js`: quitado `campos_formulario` de `CAMPS_AUDITABLES`,
  `create()` y `update()`.
- `models/Compra.js`: quitado `edit_token`/`respuestas_campos` de
  `create()`; eliminadas las funciones `findByEditToken` y
  `updateRespuestas`; quitado el `require('crypto')` (ya no se usa) y la
  lógica que excluía `edit_token` antes de guardarlo en `Historial`.
- `utils/mailer.js`: quitado el párrafo/placeholder `{{enllac_edicio}}`
  (enlace a mis-datos) del email de confirmación, de
  `VARIABLES_DISPONIBLES` y del ejemplo de email de prueba.
- `utils/validarInvitados.js`: limpiado un comentario que mencionaba
  `camposFormulario.js`.

**Frontend checkout público:**
- `public/index.html`: quitado `<div id="camps-formulari-dinamics">`.
- `public/js/checkout.js`: quitadas `renderCampsFormulariDinamics()`,
  `llegirRespostesCampsDinamics()`, la variable `campsFormulariActuals` y
  el envío de `respuestas_campos` en el body de la compra.
- `public/css/forms.css`: quitadas las clases `.camp-dinamic*`/`.opcio-dinamica*`.

**Frontend admin:**
- `public/admin/evento.html`: quitada toda la sección "Formulari de
  compra" (constructor de campos + modal de edición de campo) y el
  placeholder `{{enllac_edicio}}` de las variables del email.
- `public/js/admin.js`: quitada toda la lógica del constructor (~155
  líneas: `renderLlistaCamps`, `obrirModalCamp`, `renderOpcionsModal`,
  gestión del modal, etc.), la columna dinámica en la cabecera de la
  tabla de compras y las celdas de `respuestas_campos` por fila.
- `public/css/admin.css`: quitadas las clases huérfanas
  `.fila-camp-formulari*`, `.modal-camp-formulari*`, `.fila-opcio-camp*`,
  `.camps-formulari-buit`, `#btn-afegir-camp` (se mantienen
  `.camps-formulari-seccio`/`.camps-formulari-titol`/`.camps-formulari-ajuda`,
  que siguen usándose para el bloque de email y los textos de solo lectura
  de preu/aforament/data límit).
- `public/js/admin-historial.js`: quitada la etiqueta `campos_formulario`
  del mapa de etiquetas del historial (entradas de historial *antiguas*
  que ya mencionaran este campo mostrarán la clave en crudo en vez de la
  etiqueta bonita — cosmético, sin pérdida de datos).

**Esquema (`config/schema.sql`):** eliminadas por completo (no comentadas)
las líneas `ALTER TABLE ADD COLUMN` de `eventos.campos_formulario`,
`compras.respuestas_campos`, `compras.edit_token` y su índice único
`idx_compras_edit_token`. Esto solo afecta a instalaciones nuevas
(BD vacía) — no borra nada de una BD ya existente (ni local ni producción),
tal como funciona siempre este sistema de "sin migraciones".

**Tests:** quitados los campos fixture `respuestas_campos: {}` ya inertes
en `tests/aforo.test.js` y `tests/webhook.test.js` (no había ningún test
dedicado al sistema eliminado).

**Documentación:** quitada de `CLAUDE.md` la nota sobre por qué
`mis-datos.html`/`mis-datos.js` eran solo en catalán (ya no existen esos
archivos).

**No tocado (fuera de alcance):**
- `utils/pdfAsistentes.js` y la exportación PDF de asistentes: no
  incluían nunca columnas de `campos_formulario`/`respuestas_campos` — no
  necesitaban cambios (confirmado por el agente de investigación).
- `docs/superpowers/plans/2026-08-18-formulari-compra-personalitzat.md` y
  `docs/superpowers/specs/2026-08-18-formulari-compra-personalitzat-design.md`:
  documentos históricos de diseño de cuando se construyó la función. No
  los he tocado (no es código vivo); dime si quieres que los archive o
  borre también.

## Verificación

1. **Checkout público sin ningún campo dinámico**: confirmado visualmente
   en local — entre "En cas de necessitar factura..." y el checkbox de
   condiciones ya no aparece nada. Confirmado también por API:
   `GET /api/evento/actual` ya no incluye `campos_formulario` en la
   respuesta. ✅
2. **Admin sin poder configurar campos por evento**: confirmado
   visualmente en `evento.html` — pasa directamente de "Estat" a "Email de
   confirmació", sin ninguna sección "Formulari de compra". Probado
   también vía API: `POST /api/admin/eventos` enviando explícitamente
   `campos_formulario: [...]` en el body → se ignora, la respuesta lo
   descarta (el propio valor por defecto de la columna, que sigue en la
   BD local hasta el DROP, se ve vacío `[]`). ✅
3. **`schema.sql` aplicado desde cero no tiene las dos columnas**:
   verificado creando una base de datos Postgres completamente nueva y
   aplicando `config/schema.sql` desde cero — `\d eventos` y `\d compras`
   confirman que no existen `campos_formulario`, `respuestas_campos` ni
   `edit_token`, ni el índice `idx_compras_edit_token`. ✅
4. **`npm test`**: **50/50 pasando** (ajustados 2 fixtures inertes en
   `aforo.test.js`/`webhook.test.js`, ningún test dependía realmente del
   sistema eliminado). ✅
5. **Email de confirmación sin mención de "al·lèrgies" ni datos
   editables**: verificado con grep en todo el proyecto — 0 apariciones de
   "al·lèrgies"/"al.lergies" tras el cambio. El placeholder
   `{{enllac_edicio}}` se ha quitado de la plantilla por defecto, de
   `VARIABLES_DISPONIBLES` y de la ayuda visible en el admin. ✅

Datos de test creados y borrados tras la verificación: evento de ID 24
("Prova sense formulari") en la BD local (`portal-ventes-db-1`, puerto
55432) — no queda ningún resto. También se creó y se borró una BD
Postgres temporal (`schema_verify_fresh`) solo para la verificación del
Paso 3, dentro del contenedor de test — no queda ningún resto.

## ALTER TABLE exacto para producción (Supabase) — NO ejecutado aquí

⚠️ **Ejecuta primero la consulta de verificación del Paso 0.** Si el
recuento no es 0, decide qué hacer con esas respuestas antes de continuar
(el resto de columnas — `edit_token`, `campos_formulario` — son seguras de
borrar en cualquier caso, ya que no contienen datos de negocio).

```sql
ALTER TABLE eventos DROP COLUMN campos_formulario;
ALTER TABLE compras DROP COLUMN respuestas_campos;
DROP INDEX IF EXISTS idx_compras_edit_token;
ALTER TABLE compras DROP COLUMN edit_token;
```
