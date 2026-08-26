# Acompanyants com a mazo de cartes apilades (alçada fixa)

Substitueix el disseny de pestanyes numerades de la tanda anterior. Estat
(`acompanyantsActuals`, creixement/decreixement conservant dades, validació
completa abans d'enviar) reutilitzat sense canvis — només canvia com es
renderitza i es navega entre acompanyants.

---

## Causa exacta de per què el preu quedava amagat

`.card` (layout.css) és `display: flex` **sense** sobreescriure
`align-items` — per tant queda al valor per defecte `stretch`. Els dos fills
directes (`.panel-color`, el panell fosc amb el preu, i `.panel-white`, el
formulari) són forçats a la MATEIXA alçada: la del més alt dels dos.

Dins `.panel-color`, `.evento-meta { margin-top: auto; }` ancora el preu al
peu del panell. Quan `.panel-white` creixia (perquè el bloc d'acompanyants
apilava un bloc per cada acompanyant, o abans encara amb les pestanyes,
perquè el contenidor no tenia alçada fixa), `.panel-color` s'estirava
exactament la mateixa quantitat per l'`stretch`, i el preu —ancorat al peu—
es desplaçava avall amb ell, sortint del viewport visible.

**Confirmat per mesura directa** (Chrome, viewport de prova 900×963 real):
amb `cantidad=1` (sense bloc d'acompanyants), `.card` fa 688px d'alçada i el
preu queda a `bottom: 712.5px` (visible dins un viewport de 963px, marge de
~250px). Qualsevol creixement del bloc d'acompanyants es trasllada gairebé
1:1 a quant baixa el preu — per això calia no només fer l'alçada del bloc
**fixa** (mateixa per a qualsevol N), sinó fer-la prou **petita** per no
consumir tot el marge disponible.

La solució (contenidor `.acompanyants-mazo` amb `height` fixa en CSS,
mai calculada en funció de `n`) ataca la causa de soca-rel: `.panel-white`
ja no creix mai més enllà d'aquest valor constant, per tant `.panel-color`
tampoc s'estira, i el preu manté sempre la mateixa posició respecte al peu
del panell, independentment de quants acompanyants hi hagi.

---

## Criteri pel màxim de cartes "asomant" (MAX_ACOMPANYANTS_PEEK)

**Triat: 2** (no 3, tot i estar dins el rang suggerit 2-3), per una raó
d'espai, no estètica: el pressupost d'alçada disponible abans de tapar el
preu és molt estret (~184px calculats, verificat empíricament acabant en
150px totals pel `.acompanyants-mazo`). Cada nivell de profunditat visible
consumeix una franja de `STEP=6px` reservada tant en alçada com en amplada
del contenidor (per mantenir totes les targetes dins els límits sense
créixer'l). Amb 3 nivells la reserva hauria estat de 18px enlloc de 12px, i
amb un pressupost tan ajustat calia prioritzar deixar espai pel contingut
real (els 3 camps) per sobre d'un tercer nivell de franja decoratiu. Amb 2
nivells + comptador "+N" pels restants, l'efecte "pila de cartes" es manté
llegible sense comprometre ni l'alçada disponible pel preu ni la mida
mínima de la franja clicable (6-12px, encara raonablement premsable).

---

## Decisió de disseny no especificada a l'encàrrec: camps compactes

Per encabir els 3 camps (nom, email, telèfon) + el seu contingut dins una
targeta d'alçada molt reduïda (138px de contingut útil), calia fer-la
notablement més compacta que la resta del formulari:
- Els `<label>` de nom/email/telèfon es mantenen al DOM (accessibilitat —
  un lector de pantalla els necessita) però **visualment amagats** amb la
  classe `.sr-only` (ja existent al projecte, no se n'ha creat cap de nova).
- El número d'ordre ("Acompanyant 2") ja no té una línia pròpia de
  subtítol: es trasllada al `placeholder` del primer camp
  (`"Nom i cognoms — acompanyant 2"`), estalviant una línia sencera.
- Padding i mida de lletra dels inputs reduïts NOMÉS dins
  `.acompanyant-carta` (scoped, no afecta la resta del formulari).

Captura de com queda (4 acompanyants, 2 franges + comptador "+1"):
la targeta activa mostra els 3 camps amb placeholder; darrere seu, dues
franges desplaçades avall-dreta, i un punt fosc amb "+1" a la cantonada
inferior dreta indicant que hi ha un acompanyant més amagat del tot.

---

## Resultat de cada verificació

1. **Alçada idèntica amb `cantidad=5` (4 acompanyants) i `cantidad=2` (1
   acompanyant)** — mesurat amb `getBoundingClientRect()`:
   - `cantidad=2` (n=1): `.acompanyants-mazo` alçada = **150px**
   - `cantidad=5` (n=4): `.acompanyants-mazo` alçada = **150px**
   - **Idèntiques**, confirmat numèricament (no només "es veu semblant").

2. **Preu visible sense scroll a `cantidad=5`, viewport ~900px**:
   - `preuBottom` mesurat = **858.5px**
   - Viewport de prova real = 963px (entorn d'aquesta sessió; no s'ha pogut
     forçar exactament 900px per una limitació de `resize_window` en
     aquest entorn, veure nota tècnica avall) — però com que 858.5 < 900,
     el resultat també compleix el llindar estricte de 900px demanat, amb
     ~41px de marge.
   - Contingut de la targeta activa (3 camps): 118px necessaris dins
     138px disponibles (20px de marge, sense desbordament ni scroll).

3. **Clic en una carta de fons porta les seves dades al davant, conservant
   totes les altres**: verificat inspeccionant l'estat `acompanyantsActuals`
   després de navegar 1→2→3: cada targeta manté exactament el que s'hi
   havia escrit en visitar-la prèviament (comprovat amb dades diferents a
   cadascuna).

4. **Baixar "Nombre de places" de 4 a 3 estant a la targeta 3 (índex 2)**:
   la targeta activa passa automàticament a la 2 (índex 1, l'última
   vàlida), amb les seves dades intactes, i les dades de la targeta 1
   (índex 0) també conservades — confirmat via l'estat JS després del
   canvi.

5. **Error de validació en una targeta no visible**: amb la targeta 2
   invàlida (email buit) i veient la targeta 1, intent d'enviament →
   bloquejat, salta automàticament a la targeta 2 (la porta al davant) amb
   vora vermella ben visible i el mateix missatge genèric
   "Revisa les dades dels acompanyants: falta algun nom o l'email no és
   vàlid." — captura confirmada. En corregir l'email, la vora vermella
   desapareix a l'instant sense re-renderitzar tota la targeta (no es
   perd el focus de l'input on s'escrivia).

6. **Compra real de 3 places (comprador + 2 acompanyants)** completada amb
   targeta de prova Stripe → èxit, redirecció a `success.html`. Confirmat
   per SQL directe: `cantidad=3`, `importe_total=12000` (120,00 € = 3×40€),
   ambdós acompanyants desats correctament amb nom i email exactes.

7. **`npm test`** → **50/50** passen (backend no tocat en aquesta tanda).

Dades de prova (`[TEST-MAZO]` + compra + 2 acompanyants) eliminades en
acabar; confirmat `0` files restants per SQL directe. Servidor de
desenvolupament aturat.

### Nota tècnica sobre la mesura del viewport
L'eina `resize_window` d'aquesta sessió no ha pogut reduir efectivament el
viewport de la pestanya de Chrome (roman a `innerHeight: 963` /
`innerWidth: 1920` independentment del `width`/`height` demanats — sembla
una limitació de l'entorn/display virtual d'aquesta sessió concreta, no del
producte). Per compensar, s'ha ajustat l'alçada del mazo amb un marge de
seguretat generós (`preuBottom = 858.5px`, ~41px per sota del llindar
estricte de 900px) enlloc de confiar només en el viewport real de 963px de
l'entorn, perquè el resultat sigui vàlid també en un viewport de 900px real.
