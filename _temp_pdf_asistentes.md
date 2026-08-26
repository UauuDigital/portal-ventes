# Filtre de compres pagades + exportació a PDF d'assistents

## Llibreria de PDF: `pdfkit`

Cap dependència del projecte generava PDFs abans (confirmat: `package.json`
no en tenia cap). Es tria **pdfkit** (`^0.20.1`), tal com suggeria
l'encàrrec:
- Pur JavaScript, sense dependències de sistema (no requereix Chromium/un
  navegador headless com Puppeteer, ni binaris natius) — encaixa amb la
  resta de l'stack (Node + Express monolític, cap procés extern).
- Genera el PDF com a stream directe (`doc.pipe(res)`), sense fitxers
  temporals al disc.
- Suport nadiu de diacrítics catalans (à, è, í, ò, ç...) amb la font
  Helvetica per defecte (WinAnsi/Latin-1) — no calia incrustar cap
  tipografia pròpia.
- Molt utilitzada i estable (àmpliament adoptada a l'ecosistema Node per a
  informes/factures/llistats senzills, que és exactament aquest cas d'ús).

No hi ha cap "taula" nativa a pdfkit (a diferència d'altres llibreries més
pesades): el llistat es dibuixa manualment (columnes d'amplada fixa,
salt de pàgina amb repetició de capçalera) a `utils/pdfAsistentes.js` —
patró estàndard i suficient per a una taula de 3-4 columnes.

---

## Canvis

### Backend
- **`models/Compra.js`** — `listByEvento(eventoId, { estado })`: filtre
  opcional per `estado_pago` exacte. Sense `estado`, es manté el
  comportament de sempre (totes les compres) perquè `eliminarPerEvento`
  (que necessita comptar-les totes per l'historial) no es vegi afectat.
- **`controllers/adminController.js`**:
  - `llistarCompresEvento` filtra per `estado_pago = 'pagado'` per defecte;
    `?estado=todas` ho treu.
  - `exportarComprasCsv` **eliminada** (confirmat: no hi havia cap altre
    ús del CSV enlloc del projecte) i substituïda per
    `exportarAsistentesPdf`, amb el mateix `requireRole('admin')` que
    tenia l'exportació CSV (`viewer` no podia exportar; segueix sense
    poder-ho fer).
  - `utils/csv.js` i `tests/csv.test.js` eliminats: `toCsv` quedava òrfen
    un cop retirat l'únic lloc que el cridava.
- **`utils/pdfAsistentes.js`** (nou) — `escriureAsistentsPdf(doc, {...})`:
  aplana comprador + acompanyants de cada compra en una llista única
  d'assistents (totes les files amb el mateix format, sense distingir qui
  va comprar), amb capçalera (nom + data de l'evento + total d'assistents)
  i columna "Estat" opcional. No fa `pipe`/`end` (responsabilitat del
  crider), perquè es pugui provar sense necessitar una resposta HTTP real.
- **`routes/adminRoutes.js`** — `GET /api/admin/eventos/:id/compras/export.pdf`
  substitueix `export.csv`, mateixa protecció.
- **`tests/pdfAsistentes.test.js`** (nou) — 7 proves: aplanament correcte
  (comprador sol, amb acompanyants, múltiples compres amb estats diferents),
  PDF vàlid generat (capçalera `%PDF-`) amb/sense columna d'estat, amb zero
  assistents, i amb un llistat prou llarg per forçar un salt de pàgina.

### Frontend
- **`public/admin/evento.html`**: nou toggle "Mostrar totes les compres"
  (desmarcat per defecte) al costat del botó, ara "Exportar PDF" (abans
  "Exportar CSV").
- **`public/js/admin.js`**:
  - `carregarCompras()` passa `?estado=pagado` o `?estado=todas` segons el
    toggle.
  - Columna "Estat" (amb `badgeEstatPagament`, mateix patró de pastilla de
    color que `.admin-historial-badge`: verd/gris/vermell) s'afegeix a la
    taula NOMÉS quan el toggle és actiu.
  - `link-export-pdf` recalcula el seu `href` (amb el filtre correcte)
    cada cop que el toggle canvia.
  - Corregida una referència òrfena a l'antic `link-export-csv` dins
    `aplicarRestriccionsPerRol` (amagava l'enllaç per a `viewer`) — ara
    apunta a `link-export-pdf`.
- **`public/css/admin.css`**: `.compres-accions` (agrupa toggle + botó),
  `.checkbox-row--inline`, `.estat-pagament-badge` (+ variants de color,
  reutilitzant la mateixa paleta verd/vermell/gris ja establerta al
  projecte per a `.admin-historial-badge`, files de taula i calendari).

---

## Resultat de cada verificació

1. **Dades de prova**: evento `[TEST-PDF]`, una compra pagada de 3 places
   (Anna Roig + acompanyants Bernat Puig i Clara Vidal) i una compra
   pendent d'1 plaça (David Serra, sense acompanyants).

2. **Taula per defecte → només la pagada**: confirmat via API
   (`GET .../compras` sense paràmetre) i visualment al navegador — només
   apareix la fila d'Anna Roig. **Toggle "totes" → ambdues**: confirmat
   amb `?estado=todas`, apareixen Anna i David, amb la columna "Estat"
   mostrant pastilles "PAGAT"/"PENDENT" correctament acolorides
   (captura amb zoom confirmada).

3. **PDF amb toggle desactivat → exactament 3 files**: confirmat obrint
   el PDF generat — "3 assistents", files Anna Roig / Bernat Puig / Clara
   Vidal, totes amb el mateix format (cap distinció comprador/acompanyant),
   sense la compra pendent, sense columna "Estat".

4. **PDF amb toggle activat → exactament 4 files**: confirmat — "4
   assistents", les 3 anteriors + David Serra (Pendent, sense
   acompanyants), amb columna "Estat" (Pagat/Pendent).

5. **PDF llegible, sense text tallat ni desbordat**: confirmat obrint
   ambdós PDFs — capçalera clara (nom de l'evento en negreta + data),
   taula amb columnes ben alineades, franges alternes suaus per
   llegibilitat, cap desbordament de text entre columnes ni files.
   S'ha enviat el PDF de mostra directament al xat perquè es pugui obrir.

6. **`npm test`** → **50/50** passen (net: -6 tests de `csv.test.js`
   retirat, +7 de `pdfAsistentes.test.js` nou).

Dades de prova eliminades (evento + 2 compres + 2 acompanyants); confirmat
`0` files restants per SQL directe. Servidor de desenvolupament aturat.
