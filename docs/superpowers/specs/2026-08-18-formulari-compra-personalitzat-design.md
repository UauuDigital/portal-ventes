# Formulari de compra personalitzat (camps custom + al·lergies editables)

## Context i objectiu

Actualment el formulari de compra (`public/index.html`) té camps fixos
(comprador, email, telèfon, quantitat, facturació). Es vol que l'admin pugui
afegir camps personalitzats per esdeveniment (ex: al·lergies, talla de
samarreta), i que el comprador pugui editar les seves respostes després de
la compra mitjançant un enllaç enviat per email, fins que l'esdeveniment
tingui lloc.

## Model de dades

### `eventos`
Nova columna:
- `campos_formulario JSONB` — array ordenat de definicions de camp:
  ```json
  {
    "id": "uuid-o-slug-unic",
    "etiqueta": "Al·lèrgies",
    "tipo": "texto | numero | seleccion",
    "requerido": true,
    "unidad": "kg",           // només tipo=numero
    "min": 0,                 // només tipo=numero
    "max": 100,                // només tipo=numero
    "opciones": ["Gluten", "Lactosa", "Fruits secs"], // només tipo=seleccion
    "multiple": true           // només tipo=seleccion
  }
  ```

### `compras`
Dues columnes noves:
- `respuestas_campos JSONB` — objecte `{ [campo_id]: valor }`.
- `edit_token TEXT UNIQUE` — token aleatori (`crypto.randomBytes(24).toString('hex')`),
  generat en `Compra.create`.

Com que les respostes es guarden per `id` de camp (no per columna fixa), un
canvi posterior a `campos_formulario` (afegir/eliminar camps) no trenca
compres existents: els camps eliminats queden orfes a `respuestas_campos`
(no es netegen, simplement no es mostren); els camps nous no tenen resposta
per a compres antigues (es tracten com a buides).

## Flux de compra

1. `GET /api/evento/actual` retorna també `campos_formulario` de l'esdeveniment.
2. `index.html` renderitza dinàmicament els camps sota les dades habituals,
   validant `requerido`/`min`/`max` al frontend.
3. `POST /api/checkout/crear` revalida les respostes contra
   `campos_formulario` al backend (no confiar només en el client).
4. `Compra.create` desa `respuestas_campos` i genera `edit_token`.

## Edició posterior (accés sense login)

- `GET /api/mis-datos/:token` — retorna evento (nom, data), `campos_formulario`
  i `respuestas_campos` actuals de la compra associada al token.
- `PUT /api/mis-datos/:token` — actualitza `respuestas_campos`, revalidant
  contra `campos_formulario` vigent.
- Bloquejat (403) si `new Date() > new Date(evento.fecha)`.
- 404 si el token no existeix.
- Nova pàgina pública `public/mis-datos.html` (estil similar a `success.html`)
  que llegeix `?token=` de la URL i mostra el formulari editable.
- L'email de confirmació (Resend, `utils/mailer.js`) inclou l'enllaç
  `https://.../mis-datos.html?token=<edit_token>`. És l'únic mecanisme
  d'accés — no hi ha login de comprador.

## Admin: constructor de formulari

- Nova secció a `public/admin/evento.html`: CRUD de camps (afegir, editar,
  eliminar, reordenar), amb formulari específic per tipus
  (`texto`/`numero`/`seleccion`) i les seves propietats.
- Es desa dins el mateix payload de `POST/PUT /api/admin/eventos`
  (camp `campos_formulario`), sense endpoint nou.
- Validació al backend en desar: `numero` requereix `min`/`max` coherents
  (min ≤ max), `seleccion` requereix almenys una opció. 400 si no es compleix.

## Admin: visualització de respostes

- `llistarCompresEvento` retorna `respuestas_campos` de cada compra; la
  taula de l'admin afegeix una columna per cada `campo` definit a
  l'esdeveniment actual, llegint per `id`.
- `exportarComprasCsv` / `utils/csv.js` s'estén igual: una columna per camp
  (capçalera = `etiqueta`).

## Gestió d'errors

- Token invàlid/inexistent: 404, "Aquest enllaç no és vàlid."
- Esdeveniment ja passat: 403, "Ja no es poden modificar les dades, l'esdeveniment ja ha tingut lloc."
- Validació fallida (min/max/requerido/opció fora de llista): 400 amb
  missatge concret per camp, en català — tant en crear compra com en editar.
- Definició de camp inconsistent en desar l'esdeveniment (admin): 400 abans
  de tocar la BD.
- Camps eliminats que encara existeixen a `respuestas_campos` d'una compra
  antiga: no generen error, simplement no es mostren.

## Testing

No hi ha suite de tests automatitzats al projecte actualment; no
s'introdueix un framework nou només per aquesta feature (YAGNI). Verificació
manual:

1. Admin crea un esdeveniment amb un camp de cada tipus (`texto`, `numero`
   amb min/max/unitat, `seleccion` amb opcions múltiples).
2. Comprador completa la compra amb aquests camps; validació min/max
   funciona a frontend i backend.
3. Compra completada → email de confirmació amb enllaç d'edició.
4. Accedir a l'enllaç, modificar respostes, desar correctament.
5. Provar l'enllaç amb un esdeveniment ja passat → bloquejat amb missatge
   correcte.
6. Taula de compres i CSV de l'admin mostren les columnes noves
   correctament.
7. Editar l'esdeveniment afegint un camp nou amb compres existents →
   compres antigues no trenquen, mostren buit per aquell camp.
