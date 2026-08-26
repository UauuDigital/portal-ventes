# Acompanyants com a acordió (1 secció desplegada a la vegada)

Tercer disseny d'aquesta mateixa peça — substitueix el mazo de targetes
apilades de la tanda anterior. Estat (`acompanyantsActuals`, créixer/
decréixer conservant dades, validació completa abans d'enviar) reutilitzat
sense canvis — només canvia com es renderitza i es navega. Variable
`acompanyantTabActiva` renombrada a `acompanyantObert` (mateix concepte,
ara "quina secció està oberta" enlloc de "quina targeta està al davant").

Patró d'interacció reutilitzat literalment del desplegable d'acompanyants
de l'admin (`public/js/admin.js`/`admin.css`, `.btn-veure-acompanyants`):
mateixa icona SVG de fletxa (10×6, `M1 1l4 4 4-4`), mateix concepte de
clic per desplegar/plegar una fila de detall. La diferència és que aquí
només una secció pot estar oberta alhora (allà cada compra és independent).

---

## Confirmació que l'alçada es manté acotada (amb mesura numèrica)

A diferència del mazo (alçada fixa arbitrària), aquí la contenció surt de
l'estructura mateixa: com a màxim un panell de contingut (3 camps) està
mai al DOM, la resta són només capçaleres d'una línia. Per tant SÍ que
l'alçada creix una mica amb el nombre d'acompanyants (cada capçalera
tancada suma la seva pròpia alçada), però molt més lentament que abans
(una capçalera tancada ocupa ~28px, no un panell sencer de ~150-300px).

Mesurat amb `getBoundingClientRect()`:

| Cantidad | Acompanyants (n) | Alçada `.acompanyants-acordio` |
|---|---|---|
| 2 | 1 (0 tancades + 1 oberta) | **114.19px** |
| 5 | 4 (3 tancades + 1 oberta) | **190.08px** |

Creixement: +75.89px per 3 capçaleres tancades addicionals (~25.3px
cadascuna) — bounded i previsible, res a veure amb els +150-300px per
acompanyant addicional que suposaven els dissenys anteriors (pestanyes
apilades / mazo amb targetes completes). Verificat també visualment: amb
`cantidad=5`, el bloc és exactament "3 capçaleres tancades + 1 panell
obert" (captura confirmada), tal com demanava el punt 1 de verificació.

---

## Causa raó reconfirmada (mateixa que el mazo, atacada de la mateixa manera)

La mateixa documentada a `_temp_mazo_acompanyants.md`: `.card` és
`display: flex` sense `align-items` propi (hereta `stretch`), i
`.evento-meta { margin-top: auto; }` ancora el preu al peu del panell
fosc — qualsevol creixement del formulari es trasllada gairebé 1:1 a
quant baixa el preu. L'acordió ataca la mateixa causa (mantenir
`.panel-white` tan compacte com sigui possible), simplement amb una
estratègia diferent per aconseguir-ho: en lloc d'una alçada fixa
artificial, deixa que la mida natural del contingut (capçaleres petites +
com a molt un panell) sigui per si mateixa prou continguda.

---

## Decisions d'estil no especificades a l'encàrrec

1. **Un sol contenidor amb vora pròpia i divisors fins entre seccions**
   (`.acompanyants-acordio`), en lloc d'una vora + radi + marge propis per
   a cada secció per separat. Es llegeix com una única llista (com el
   patró de l'admin) i estalvia espai duplicat (vores i marges que se
   sumaven innecessàriament).
2. **Camps compactes amb labels amagats** (`.sr-only`, ja existent al
   projecte) i placeholder com a única pista visual — mateixa tècnica que
   el mazo de la tanda anterior. Amb una capçalera per acompanyant, calia
   mantenir el panell obert el més petit possible perquè el bloc sencer
   no s'acostés al llindar d'alçada abans de tapar el preu.
3. **Marge de seguretat més ajustat que el del mazo**: aquesta tanda
   arriba a `preuBottom = 882px` (amb `cantidad=5`) davant d'un llindar
   de 900px — **18px de marge**, notablement més ajustat que els ~41px de
   la tanda anterior. És estructural: un acordió amb 4 capçaleres sempre
   ocuparà més que un bloc d'alçada fixa d'un sol valor arbitrari; per
   sota d'aquest punt calia triar entre comprimir més els camps (perdent
   llegibilitat) o acceptar un marge més just. Es prioritza la
   llegibilitat i es documenta explícitament aquí perquè es pugui revisar
   si es vol més coixí.
4. **Text de la capçalera en vermell** com a indicador d'error de secció
   (enlloc d'un punt/badge com al mazo): més consistent amb el fet que la
   capçalera ja és text pla, sense necessitat d'afegir cap element nou.
5. **Vora vermella pels camps concrets** (nom i/o email, no el panell
   sencer) mitjançant el pseudo-classe natiu `:invalid` del navegador
   (gated darrere `.acompanyants-acordio--validat`, que només s'activa
   després d'un intent d'enviament fallit) — no calculat a mà en JS,
   perquè ja existeix required/type=email als inputs.

---

## Resultat de cada verificació

1. **`cantidad=5` (4 acompanyants) → el bloc no supera "3 capçaleres
   tancades + 1 panell obert"**: confirmat numèricament (taula amunt) i
   visualment (captura). 190.08px amb 4 acompanyants vs. 114.19px amb 1.

2. **Preu visible sense scroll amb `cantidad=5`**: `preuBottom = 882px`,
   per sota del llindar de 900px (marge 18px). Nota tècnica: com a la
   tanda anterior, `resize_window` no ha pogut reduir efectivament el
   viewport d'aquesta sessió (roman a `innerHeight: 963` independentment
   del `width`/`height` demanats) — s'ha aplicat el mateix criteri que
   llavors: ajustar l'alçada fins que `preuBottom` quedi còmodament per
   sota del llindar estricte de 900px, no només del viewport real de 963.

3. **Obrir "Acompanyant 2" tanca "Acompanyant 1" automàticament, dades
   conservades**: confirmat inspeccionant l'estat — només una capçalera
   amb `aria-expanded="true"` en cada moment, i `acompanyantsActuals[0]`
   intacte (`"Acompanyant U"` / `"u1@example.com"`) després de navegar.

4. **Baixar "Nombre de places" amb diverses seccions plenes conserva les
   que queden**: provat baixant de 4 a 3 acompanyants estant a la secció
   3 (oberta i plena) → es descarta la 3a, la secció oberta passa
   automàticament a la 2 (l'última vàlida), i les dades de la secció 1
   (`"Acompanyant U"`) i 2 (`"Acompanyant Dos"`) es mantenen íntegres.

5. **Error de validació en una secció tancada → s'obre automàticament amb
   l'error visible**: amb la secció 2 invàlida (email buit) i veient la
   secció 1, intent d'enviament → bloquejat, la secció 2 s'obre sola (la
   1 es tanca), la seva capçalera es pinta en vermell I el camp "Email"
   concret queda amb vora vermella (no el panell sencer), amb el mateix
   missatge genèric "Revisa les dades dels acompanyants: falta algun nom
   o l'email no és vàlid." — capturat i confirmat amb zoom. En corregir
   l'email, tant el vermell de la capçalera com el del camp desapareixen
   a l'instant (el del camp és `:invalid` natiu, en viu; el de la
   capçalera es repinta en JS sense perdre el focus de l'input).

6. **Compra real de 3 places (comprador + 2 acompanyants)** completada
   amb targeta de prova Stripe → èxit, redirecció a `success.html`.
   Confirmat per SQL directe: `cantidad=3`, `importe_total=9000`
   (90,00 € = 3×30€), ambdós acompanyants desats correctament amb nom i
   email exactes.

7. **`npm test`** → **50/50** passen (backend no tocat en aquesta tanda).

Dades de prova (`[TEST-ACORDIO]` + compra + 2 acompanyants) eliminades en
acabar; confirmat `0` files restants per SQL directe. Servidor de
desenvolupament aturat.
