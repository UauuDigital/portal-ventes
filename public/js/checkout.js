let eventoSeleccionatId = null;
let precioUnitari = 0; // cèntims, preu unitari de l'evento carregat

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
}

// Igual que escapeHtml, però també escapa les cometes: cal fer-la servir
// quan el valor s'insereix dins un atribut HTML delimitat per cometes
// dobles (p. ex. value="${escapeAttr(valor)}"), perquè escapeHtml sol no
// escapa el caràcter " i una cometa dins el valor trencaria l'atribut.
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const LOCALE = 'ca-ES';

const TEXTOS = {
  motiu_no_event: 'Ara mateix no hi ha cap esdeveniment obert per a la venda de places.',
  motiu_data_limit: 'El termini de compra per a aquest esdeveniment ha finalitzat.',
  motiu_aforament: "Les places per a aquest esdeveniment s'han esgotat.",
  motiu_default: 'La compra no està disponible ara mateix.',
  evento_default_desc: 'Torna aviat per veure el proper esdeveniment.',
  places_disponibles: 'places disponibles',
  error_connexio: "No s'ha pogut connectar amb el servidor. Torna-ho a provar.",
  error_inesperat: 'Error inesperat.',
  btn_comprar: 'Pagar i reservar plaça',
  btn_comprar_processant: 'Processant…',
};

function t(clau) {
  return TEXTOS[clau] || clau;
}

/** Mateix format que ja fa servir la resta del projecte per a imports en
 * cèntims (formatEuros a public/js/admin.js i utils/mailer.js): "70.00 €". */
function formatEuros(centims) {
  return (centims / 100).toFixed(2) + ' €';
}

/** Data en català sense hora (ex: "3 de setembre de 2026"), per a la fitxa
 * del checkout — mateix mecanisme que ja fa servir utils/mailer.js al
 * backend (formatDataHora), sense la part de l'hora perquè aquí no cal. */
function formatDataSenseHora(isoString) {
  return new Date(isoString).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Uneix un prefix i un número en un sol camp de text (p. ex.
 * "+34 612345678"), tal com espera el backend. Si no hi ha número, no
 * s'envia cap prefix sol. Es fa servir tant per llegir el camp del
 * comprador (del DOM, sempre present) com per l'estat en memòria de cada
 * acompanyant (cal llegir-ho de l'array, no del DOM, perquè les seccions
 * tancades de l'acordió no tenen els seus inputs al DOM). */
function combinarPrefixNumero(prefix, numero) {
  const n = numero.trim();
  return n ? `${prefix} ${n}` : '';
}

/** Llegeix el camp de telèfon del comprador (número + prefix triat) del
 * DOM. `#form-compra > .camp-telefon` és el selector amb fill directe
 * perquè només agafi el del comprador — el d'un acompanyant obert queda
 * niat dins #acompanyants-dinamics, no com a fill directe del formulari. */
function combinarTelefonAmbPrefix() {
  const campTelefon = document.querySelector('#form-compra > .camp-telefon');
  const numero = campTelefon.querySelector('input[type="tel"]').value;
  const prefix = campTelefon.querySelector('.prefix-telefon-valor').value;
  return combinarPrefixNumero(prefix, numero);
}

// Desplegable personalitzat de prefix telefònic (bandera + país + codi),
// més visual que un <select> natiu (que el navegador pinta sense poder-lo
// personalitzar). Les banderes són SVG inline (no emojis): un emoji de
// bandera depèn d'una font de color instal·lada al sistema operatiu i en
// molts Windows es veu com a text (codi de país) en lloc de la bandera.
function svgH(...colors) {
  const h = 2 / colors.length;
  const rects = colors.map((c, i) => `<rect y="${i * h}" width="3" height="${h + 0.02}" fill="${c}"/>`).join('');
  return `<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
function svgV(...colors) {
  const w = 3 / colors.length;
  const rects = colors.map((c, i) => `<rect x="${i * w}" width="${w + 0.02}" height="2" fill="${c}"/>`).join('');
  return `<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

const BANDERES = {
  ES: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
  AD: svgV('#0018A8', '#FEDF00', '#D50032'),
  FR: svgV('#0055A4', '#FFFFFF', '#EF4135'),
  PT: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="1.2" height="2" fill="#046A38"/><rect x="1.2" width="1.8" height="2" fill="#DA291C"/></svg>',
  IT: svgV('#009246', '#FFFFFF', '#CE2B37'),
  DE: svgH('#000000', '#DD0000', '#FFCE00'),
  GB: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#00247D"/><rect x="1.25" width="0.5" height="2" fill="#FFFFFF"/><rect y="0.75" width="3" height="0.5" fill="#FFFFFF"/><rect x="1.4" width="0.2" height="2" fill="#CF142B"/><rect y="0.9" width="3" height="0.2" fill="#CF142B"/></svg>',
  NL: svgH('#AE1C28', '#FFFFFF', '#21468B'),
  BE: svgV('#000000', '#FAE042', '#ED2939'),
  CH: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#D52B1E"/><rect x="1.25" y="0.4" width="0.5" height="1.2" fill="#FFFFFF"/><rect x="0.9" y="0.75" width="1.2" height="0.5" fill="#FFFFFF"/></svg>',
  IE: svgV('#169B62', '#FFFFFF', '#FF883E'),
  US: `<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">${[0, 1, 2, 3, 4]
    .map((i) => `<rect y="${i * 0.4}" width="3" height="0.42" fill="${i % 2 === 0 ? '#B31942' : '#FFFFFF'}"/>`)
    .join('')}<rect width="1.3" height="1.2" fill="#0A3161"/></svg>`,
  MX: svgV('#006847', '#FFFFFF', '#CE1126'),
  AR: svgH('#74ACDF', '#FFFFFF', '#74ACDF'),
  BR: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#009739"/><polygon points="1.5,0.2 2.7,1 1.5,1.8 0.3,1" fill="#FEDD00"/></svg>',
};

const PAISOS_PREFIX = [
  { iso: 'ES', nom: 'Espanya', codi: '+34' },
  { iso: 'AD', nom: 'Andorra', codi: '+376' },
  { iso: 'FR', nom: 'França', codi: '+33' },
  { iso: 'PT', nom: 'Portugal', codi: '+351' },
  { iso: 'IT', nom: 'Itàlia', codi: '+39' },
  { iso: 'DE', nom: 'Alemanya', codi: '+49' },
  { iso: 'GB', nom: 'Regne Unit', codi: '+44' },
  { iso: 'NL', nom: 'Països Baixos', codi: '+31' },
  { iso: 'BE', nom: 'Bèlgica', codi: '+32' },
  { iso: 'CH', nom: 'Suïssa', codi: '+41' },
  { iso: 'IE', nom: 'Irlanda', codi: '+353' },
  { iso: 'US', nom: 'Estats Units', codi: '+1' },
  { iso: 'MX', nom: 'Mèxic', codi: '+52' },
  { iso: 'AR', nom: 'Argentina', codi: '+54' },
  { iso: 'BR', nom: 'Brasil', codi: '+55' },
];

// Tanca un desplegable de prefix concret, identificat pel seu contenidor
// ".prefix-telefon" — funció independent de qualsevol tancament d'una
// instància concreta perquè els listeners globals de "clic fora"/Escape
// (registrats un sol cop a DOMContentLoaded) la puguin cridar per a
// QUALSEVOL instància oberta (comprador o un acompanyant), sense haver de
// mantenir viva la clausura de cada inicialitzarPrefixTelefon.
function tancarPrefixTelefon(contenidorPrefix) {
  if (!contenidorPrefix) return;
  contenidorPrefix.querySelector('.prefix-telefon-llista').classList.add('hidden');
  contenidorPrefix.querySelector('.prefix-telefon-btn').setAttribute('aria-expanded', 'false');
}

// Inicialitza una instància independent del desplegable de prefix
// telefònic dins `contenidor` (un ".prefix-telefon"). Generalitzada per
// admetre'n diverses a la mateixa pàgina (el comprador, sempre present, i
// cada acompanyant obert de l'acordió — vegeu seccioAcompanyantHtml i
// renderAcompanyants): tot es llegeix/escriu via `contenidor.querySelector`
// (no ids globals), així que dues instàncies mai interfereixen entre si.
// `prefixInicial` marca amb quin país es pinta en obrir (per defecte +34,
// però cada acompanyant recorda el seu propi triat — vegeu
// acompanyantsActuals[i].prefixTelefon). `onTriar(codi)` és opcional: la
// crida el comprador no la necessita (el seu DOM no es torna a construir
// mai), però cada acompanyant sí, per desar la tria a l'array i no
// perdre-la en tancar/reobrir la seva secció de l'acordió.
function inicialitzarPrefixTelefon(contenidor, prefixInicial, onTriar) {
  if (!contenidor) return;

  const btn = contenidor.querySelector('.prefix-telefon-btn');
  const llista = contenidor.querySelector('.prefix-telefon-llista');
  const inputAmagat = contenidor.querySelector('.prefix-telefon-valor');
  const spanBandera = contenidor.querySelector('.prefix-telefon-bandera');
  const spanCodi = contenidor.querySelector('.prefix-telefon-codi');
  const paisInicial = PAISOS_PREFIX.find((p) => p.codi === prefixInicial) || PAISOS_PREFIX[0];

  llista.innerHTML = PAISOS_PREFIX.map(
    (p, i) => `
      <li role="option" data-iso="${p.iso}" data-codi="${p.codi}" data-index="${i}" tabindex="-1">
        <span class="prefix-telefon-opcio-bandera">${BANDERES[p.iso]}</span>
        <span class="prefix-telefon-opcio-nom">${p.nom}</span>
        <span class="prefix-telefon-opcio-codi">${p.codi}</span>
      </li>
    `
  ).join('');
  spanBandera.innerHTML = BANDERES[paisInicial.iso];
  spanCodi.textContent = paisInicial.codi;
  inputAmagat.value = paisInicial.codi;
  btn.setAttribute('aria-label', `Prefix telefònic: ${paisInicial.nom}, ${paisInicial.codi}`);

  btn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (llista.classList.contains('hidden')) {
      llista.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      tancarPrefixTelefon(contenidor);
    }
  });
  llista.addEventListener('click', (evt) => {
    const opcio = evt.target.closest('li');
    if (!opcio) return;
    const nomPais = opcio.querySelector('.prefix-telefon-opcio-nom').textContent;
    spanBandera.innerHTML = BANDERES[opcio.dataset.iso];
    spanCodi.textContent = opcio.dataset.codi;
    inputAmagat.value = opcio.dataset.codi;
    btn.setAttribute('aria-label', `Prefix telefònic: ${nomPais}, ${opcio.dataset.codi}`);
    if (onTriar) onTriar(opcio.dataset.codi);
    tancarPrefixTelefon(contenidor);
  });
}

async function carregarEvento(eventoId) {
  const url = eventoId
    ? `/api/evento/actual?id=${eventoId}`
    : `/api/evento/actual`;
  const res = await fetch(url);
  const data = await res.json();

  const form = document.getElementById('form-compra');
  const avis = document.getElementById('estat-no-disponible');
  form.classList.remove('hidden');
  avis.classList.add('hidden');

  if (!data.disponible) {
    form.classList.add('hidden');
    avis.classList.remove('hidden');
    const motius = {
      no_hi_ha_event_actiu: t('motiu_no_event'),
      data_limit_superada: t('motiu_data_limit'),
      aforament_exhaurit: t('motiu_aforament'),
    };
    avis.textContent = motius[data.motiu] || t('motiu_default');
    document.getElementById('evento-data').textContent = '';
    document.getElementById('evento-preu').textContent = '';
    precioUnitari = 0;
    if (data.evento) {
      document.getElementById('evento-nombre').textContent = data.evento.nombre;
      document.getElementById('evento-descripcio').textContent = data.evento.descripcion || '';
    } else {
      document.getElementById('evento-nombre').textContent = 'Espai Econòmic';
      document.getElementById('evento-descripcio').textContent = t('evento_default_desc');
    }
    renderConvidats([]);
    return null;
  }

  const ev = data.evento;
  eventoSeleccionatId = ev.id;
  precioUnitari = ev.precio;
  document.getElementById('evento-nombre').textContent = ev.nombre;
  document.getElementById('evento-descripcio').textContent = ev.descripcion || '';
  document.getElementById('evento-data').textContent = formatDataSenseHora(ev.fecha);
  actualitzarPreu();
  renderConvidats(ev.invitados || []);

  return ev;
}

// Ficha de convidats/ponents de l'esdeveniment (informatiu, no res que
// respongui el comprador). Sense numerar-los: un de sol es llegeix com una
// simple fitxa; el separador entre files (CSS, selector `+`) només apareix
// quan n'hi ha més d'un, per aportar aire sense fer-ho artificialment.
function renderConvidats(invitados) {
  const bloc = document.getElementById('evento-convidats');
  const cont = document.getElementById('evento-convidats-llista');
  const llista = (invitados || []).filter((inv) => inv && inv.nombre);

  if (llista.length === 0) {
    bloc.classList.add('hidden');
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = llista.map((inv) => `
    <p class="evento-convidat">
      <span class="evento-convidat-nom">${escapeHtml(inv.nombre)}</span>
      ${inv.cargo ? `<span class="evento-convidat-carrec">${escapeHtml(inv.cargo)}</span>` : ''}
    </p>
  `).join('');
  bloc.classList.remove('hidden');
}

// Acompanyants: apareixen/creixen quan "Nombre de places" (cantidad) és
// més gran d'1 — cal exactament cantidad - 1 (el comprador principal ja
// compta com a 1 plaça, ell no s'hi repeteix). L'array es manté persistent
// entre canvis de cantidad: si es puja de 2 a 3 s'afegeix una fila buida
// al final; si es baixa de 3 a 2 es descarta només l'última, sense tocar
// les dades ja escrites a les que es mantenen.
//
// Es mostren com un acordió: una capçalera "Acompanyant N" per cadascun,
// amb com a molt un panell desplegat alhora — obrir-ne un tanca
// automàticament el que estigués obert. Així l'alçada del bloc mai depèn
// del nombre d'acompanyants (només suma capçaleres tancades, que ocupen
// poc), a diferència del mazo de targetes de la tanda anterior. Només la
// secció oberta té els seus <input> al DOM en cada moment — per això, a
// diferència del comprador principal (sempre visible, validable només amb
// required/type=email natius), aquí cal una validació pròpia en JS abans
// d'enviar: si no, les dades d'una secció tancada no es comprovarien mai.
let acompanyantsActuals = [];
let acompanyantObert = -1; // índex de la secció oberta; -1 = totes tancades

// Es marca a true només després d'un intent d'enviament que ha fallat per
// dades d'acompanyants invàlides, perquè cap indicador d'error aparegui
// abans que l'usuari hagi ni intentat enviar el formulari.
let intentAcompanyantsFallit = false;

// Mateixa regex que utils/validacio.js (EMAIL_REGEX) al backend, perquè el
// criteri de "email vàlid" no divergeixi entre el que s'ensenya aquí i el
// que de veritat exigeix el servidor.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function acompanyantInvalid(ac) {
  return !ac.nombre.trim() || !EMAIL_REGEX.test(ac.email.trim());
}

// Fletxa del desplegable, reutilitzada literalment (mateix SVG, no se
// n'ha creat cap de nou) del desplegable d'acompanyants de l'admin
// (public/js/admin.js) i del prefix telefònic (public/index.html).
const ICONA_CHEVRON = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Genera el HTML d'una secció de l'acordió. Només la secció oberta porta
// els tres camps editables al DOM; les tancades només tenen la capçalera
// (i un contenidor buit perquè aria-controls apunti a un element real).
//
// Els camps (label + input) són idèntics als del comprador principal —
// mateix <label> visible, mateixos estils heretats de la resta del
// formulari, sense cap tractament compacte: ja no cal estalviar alçada
// (l'acordió pot créixer lliurement en obrir una secció, vegeu forms.css).
function seccioAcompanyantHtml(i, oberta) {
  const ac = acompanyantsActuals[i];
  const invalida = intentAcompanyantsFallit && acompanyantInvalid(ac);
  const panellId = `acompanyant-panell-${i}`;

  return `
    <div class="acompanyant-seccio${invalida ? ' acompanyant-seccio--error' : ''}">
      <button type="button" class="acompanyant-capcalera" data-i="${i}" aria-expanded="${oberta}" aria-controls="${panellId}">
        <span>Acompanyant ${i + 1}</span>
        ${ICONA_CHEVRON}
      </button>
      ${oberta ? `
        <div class="acompanyant-panell" id="${panellId}">
          <label for="acompanyant_nom">Nom i cognoms</label>
          <input type="text" id="acompanyant_nom" data-camp="nombre" value="${escapeAttr(ac.nombre)}" required>
          <label for="acompanyant_email">Email</label>
          <input type="email" id="acompanyant_email" data-camp="email" value="${escapeAttr(ac.email)}" required>
          <label for="acompanyant_telefon">Telèfon</label>
          <div class="camp-telefon">
            <div class="prefix-telefon">
              <button type="button" class="prefix-telefon-btn" aria-haspopup="listbox" aria-expanded="false">
                <span class="prefix-telefon-bandera"></span>
                <span class="prefix-telefon-codi">+34</span>
                ${ICONA_CHEVRON}
              </button>
              <ul class="prefix-telefon-llista hidden" role="listbox" aria-label="Prefix del país"></ul>
              <input type="hidden" class="prefix-telefon-valor" value="+34">
            </div>
            <input type="tel" id="acompanyant_telefon" data-camp="telefono" value="${escapeAttr(ac.telefono)}">
          </div>
        </div>
      ` : `<div id="${panellId}" class="hidden"></div>`}
    </div>
  `;
}

function renderAcompanyants(n) {
  const cont = document.getElementById('acompanyants-dinamics');
  const eraBuit = acompanyantsActuals.length === 0;

  while (acompanyantsActuals.length < n) acompanyantsActuals.push({ nombre: '', email: '', telefono: '', prefixTelefon: '+34' });
  acompanyantsActuals.length = n;

  if (n === 0) {
    cont.innerHTML = '';
    acompanyantObert = -1;
    return;
  }

  if (eraBuit) {
    // Primer cop que apareix el bloc (cantidad passa d'1 a 2+): totes les
    // seccions comencen plegades, l'usuari tria quina obrir.
    acompanyantObert = -1;
  } else if (acompanyantObert > n - 1) {
    // La secció oberta ha deixat d'existir (cantidad ha baixat): es passa
    // a l'última vàlida.
    acompanyantObert = n - 1;
  }

  const seccionsHtml = Array.from({ length: n }, (_, i) => seccioAcompanyantHtml(i, i === acompanyantObert)).join('');

  cont.innerHTML = `
    <p class="acompanyants-titol">Dades dels acompanyants${n > 1 ? ` (${n})` : ''}</p>
    <div class="acompanyants-acordio${intentAcompanyantsFallit ? ' acompanyants-acordio--validat' : ''}">${seccionsHtml}</div>
  `;

  cont.querySelectorAll('.acompanyant-capcalera').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i, 10);
      // Clic sobre la que ja estava oberta: es tanca (cap oberta). Clic
      // sobre una altra: aquesta s'obre i la resta es tanquen soles,
      // perquè només n'hi ha una al DOM al mateix temps (acompanyantObert
      // és un únic índex).
      acompanyantObert = acompanyantObert === i ? -1 : i;
      renderAcompanyants(acompanyantsActuals.length);
    });
  });

  cont.querySelectorAll('input[data-camp]').forEach((input) => {
    input.addEventListener('input', () => {
      acompanyantsActuals[acompanyantObert][input.dataset.camp] = input.value;
      // Repinta només la classe d'error de la secció oberta (no tot
      // l'acordió, per no perdre el focus/cursor de l'input on l'usuari
      // està escrivint) perquè s'esborri a l'instant en corregir-se. La
      // vora vermella dels camps concrets ja es repinta sola (CSS
      // :invalid, vegeu forms.css) sense necessitat de JS addicional.
      if (intentAcompanyantsFallit) {
        input.closest('.acompanyant-seccio')
          .classList.toggle('acompanyant-seccio--error', acompanyantInvalid(acompanyantsActuals[acompanyantObert]));
      }
    });
  });

  // Desplegable de prefix de la secció oberta: instància pròpia i
  // independent (vegeu inicialitzarPrefixTelefon), inicialitzada amb el
  // prefix que aquest acompanyant ja tenia triat (o +34 per defecte si
  // n'és la primera vegada), i que desa qualsevol tria nova de tornada a
  // l'array perquè no es perdi en tancar la secció.
  const panellObert = cont.querySelector('.acompanyant-panell');
  if (panellObert) {
    inicialitzarPrefixTelefon(
      panellObert.querySelector('.prefix-telefon'),
      acompanyantsActuals[acompanyantObert].prefixTelefon,
      (codi) => { acompanyantsActuals[acompanyantObert].prefixTelefon = codi; }
    );
  }
}

function actualitzarAcompanyants() {
  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;
  renderAcompanyants(Math.max(0, cantidad - 1));
}

// Stepper de "Nombre de places": +/- només toquen l'input #cantidad (el
// que ja es llegia a mà abans) i en disparen l'event "input", perquè el
// recàlcul de preu i acordeó d'acompanyants segueixi passant pel listener
// existent (dispatchEvent) en lloc de duplicar-lo aquí.
function actualitzarEstatStepperCantidad() {
  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;
  document.getElementById('cantidad-valor').textContent = cantidad;
  document.getElementById('btn-cantidad-menys').disabled = cantidad <= 1;
}

function canviarCantidad(delta) {
  const input = document.getElementById('cantidad');
  const actual = parseInt(input.value, 10) || 1;
  const nova = Math.max(1, actual + delta);
  if (nova === actual) return;
  input.value = nova;
  actualitzarEstatStepperCantidad();
  input.dispatchEvent(new Event('input'));
}

// Preu de la fitxa: es repinta amb el preu unitari de l'evento (precioUnitari)
// multiplicat per "Nombre de places". El preu real cobrat es calcula al
// backend (crearCheckoutSession); això és només reflex visual.
function actualitzarPreu() {
  if (!precioUnitari) return;
  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;
  document.getElementById('evento-preu').textContent = formatEuros(cantidad * precioUnitari);
}

function calcularAforo(disponibles, total) {
  const percentOcupat = Math.min(100, Math.max(0, ((total - disponibles) / total) * 100));
  const percentDisponible = 100 - percentOcupat;
  let classe = '';
  if (percentDisponible <= 15) {
    classe = 'aforo-bar-fill--baixa';
  } else if (percentDisponible <= 40) {
    classe = 'aforo-bar-fill--mitja';
  }
  return { percentOcupat, classe };
}

function mostrarFormulariEvento(eventoId, desSelector) {
  document.getElementById('selector-esdeveniments').classList.add('hidden');
  document.getElementById('main-card').classList.remove('hidden');
  document.getElementById('btn-tornar-selector').classList.toggle('hidden', !desSelector);
  carregarEvento(eventoId);
}

function netejarAnimacioSeleccio() {
  const grid = document.getElementById('selector-grid');
  grid.querySelectorAll('.selector-btn--seleccionant').forEach((b) => b.classList.remove('selector-btn--seleccionant'));
}

function tornarAlSelector() {
  document.getElementById('main-card').classList.add('hidden');
  document.getElementById('selector-esdeveniments').classList.remove('hidden');
  netejarAnimacioSeleccio();
}

let ultimsEventosSelector = [];
const DURADA_ANIM_CLIC = 400; // ms — cobreix l'animació Ripple

/* Comença amb 3 columnes; si amb aquestes hi hauria més de 5 files,
   n'afegeix una de nova i torna a comprovar, fins que hi càpiguen en
   5 files o menys (o fins que hi hagi tantes columnes com esdeveniments). */
function calcularColumnesSelector(numEventos) {
  const MAX_FILES = 5;
  let cols = 3;
  while (Math.ceil(numEventos / cols) > MAX_FILES && cols < numEventos) {
    cols += 1;
  }
  return Math.max(1, Math.min(cols, numEventos));
}

function renderSelectorEsdeveniments(eventos) {
  ultimsEventosSelector = eventos;
  const grid = document.getElementById('selector-grid');
  const contenidor = document.getElementById('selector-esdeveniments');
  contenidor.style.setProperty('--selector-cols', calcularColumnesSelector(eventos.length));
  netejarAnimacioSeleccio();
  grid.innerHTML = '';
  eventos.forEach((ev, i) => {
    const { percentOcupat, classe } = calcularAforo(ev.aforo_disponible, ev.aforo_total);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'selector-btn';
    btn.style.setProperty('--i', i);
    btn.innerHTML = `
      <span class="selector-btn-nom">${escapeHtml(ev.nombre)}</span>
      <span class="selector-btn-data"><span aria-hidden="true">📅</span> ${escapeHtml(new Date(ev.fecha).toLocaleString(LOCALE))}</span>
      <div class="aforo-bar aforo-bar--selector">
        <div class="aforo-bar-fill ${classe}" style="width:${percentOcupat}%"></div>
      </div>
      <span class="selector-btn-aforo"><span aria-hidden="true">🎟️</span> ${ev.aforo_disponible} ${escapeHtml(t('places_disponibles'))}</span>
    `;

    btn.addEventListener('click', (evt) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--click-x', `${evt.clientX - rect.left}px`);
      btn.style.setProperty('--click-y', `${evt.clientY - rect.top}px`);
      btn.classList.add('selector-btn--seleccionant');
      const reduitMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => mostrarFormulariEvento(ev.id, true), reduitMotion ? 0 : DURADA_ANIM_CLIC);
    });

    grid.appendChild(btn);
  });
  document.getElementById('selector-esdeveniments').classList.remove('hidden');
  document.getElementById('main-card').classList.add('hidden');
}

async function iniciar() {
  const res = await fetch(`/api/evento/actius`);
  const eventos = await res.json();

  if (eventos.length > 1) {
    renderSelectorEsdeveniments(eventos);
    return;
  }

  document.getElementById('main-card').classList.remove('hidden');
  await carregarEvento(eventos.length === 1 ? eventos[0].id : undefined);
}

function comprovarAccesAdmin(evt) {
  if (document.getElementById('nombre_comprador').value.trim().toLowerCase() === 'admin') {
    evt.preventDefault();
    evt.stopPropagation();
    window.location.href = '/admin/login.html';
  }
}

// Substitueix el globus de validació nativa del navegador (el "Completa
// aquest camp"): el formulari porta `novalidate` a l'HTML perquè no
// aparegui, i aquesta funció fa la mateixa comprovació
// (form.checkValidity(), basada en required/type=... dels <input>) però
// mostrant l'error amb el mateix bloc #error-missatge que ja fa servir la
// resta del formulari, amb focus al primer camp que falla. Mateix patró
// visual que ja tenia l'acordió d'acompanyants (:invalid + una classe
// "--validat" que activa la vora vermella, vegeu forms.css) — aquí
// generalitzat a .form-validat per no inventar-ne un altre.
function missatgeValidacioCamp(camp) {
  if (!camp) return 'Revisa les dades del formulari.';
  if (camp.type === 'checkbox' && camp.validity.valueMissing) {
    return "Has d'acceptar-ho per continuar.";
  }
  if (camp.validity.valueMissing) return 'Aquest camp és obligatori.';
  if (camp.validity.typeMismatch) return 'Introdueix un email vàlid.';
  return camp.validationMessage || 'Revisa aquest camp.';
}

function validarCampsNatius(form, errorEl) {
  form.classList.add('form-validat');
  if (form.checkValidity()) return true;
  const camp = form.querySelector(':invalid');
  if (camp) camp.focus();
  if (errorEl) errorEl.textContent = missatgeValidacioCamp(camp);
  return false;
}

async function enviarFormulari(evt) {
  evt.preventDefault();

  const btn = document.getElementById('btn-comprar');
  const errorEl = document.getElementById('error-missatge');
  errorEl.textContent = '';

  if (!validarCampsNatius(evt.target, errorEl)) return;

  btn.disabled = true;
  btn.textContent = t('btn_comprar_processant');

  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;

  // Amb l'acordió, només la secció oberta té els inputs al DOM en aquest
  // moment — required/type=email natius només poden validar-la a ella.
  // Cal comprovar aquí explícitament TOTS els acompanyants (incloses les
  // seccions tancades) abans d'enviar, i si algun falla, obrir la primera
  // secció amb problema perquè l'usuari sàpiga exactament on tornar.
  if (cantidad > 1) {
    const primerInvalid = acompanyantsActuals.slice(0, cantidad - 1).findIndex(acompanyantInvalid);
    if (primerInvalid !== -1) {
      intentAcompanyantsFallit = true;
      acompanyantObert = primerInvalid;
      renderAcompanyants(cantidad - 1);
      errorEl.textContent = "Revisa les dades dels acompanyants: falta algun nom o l'email no és vàlid.";
      btn.disabled = false;
      btn.textContent = t('btn_comprar');
      return;
    }
  }

  const body = {
    evento_id: eventoSeleccionatId,
    cantidad: document.getElementById('cantidad').value,
    nombre_comprador: document.getElementById('nombre_comprador').value,
    email: document.getElementById('email').value,
    telefono: combinarTelefonAmbPrefix(),
    accepta_condicions: document.getElementById('accepta_condicions').checked,
  };

  // Amb cantidad=1 el cos no porta la clau acompanyants en absolut (el
  // backend tampoc l'exigeix ni la llegeix en aquest cas).
  if (cantidad > 1) {
    body.acompanyants = acompanyantsActuals.slice(0, cantidad - 1).map((ac) => ({
      nombre: ac.nombre.trim(),
      email: ac.email.trim(),
      telefono: combinarPrefixNumero(ac.prefixTelefon, ac.telefono),
    }));
  }

  try {
    const res = await fetch('/api/checkout/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.detalls ? data.detalls.join(', ') : (data.error || t('error_inesperat'));
      btn.disabled = false;
      btn.textContent = t('btn_comprar');
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    errorEl.textContent = t('error_connexio');
    btn.disabled = false;
    btn.textContent = t('btn_comprar');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  iniciar();
  inicialitzarPrefixTelefon(document.querySelector('#form-compra > .camp-telefon .prefix-telefon'), '+34');
  // Tanca qualsevol desplegable de prefix obert (comprador o un
  // acompanyant) en clicar fora seu o prémer Escape — un sol listener
  // delegat per a totes les instàncies possibles, en lloc que cadascuna
  // en registri un de propi (evitaria acumular-ne un per cada vegada que
  // es renderitza una secció de l'acordió).
  document.addEventListener('click', (evt) => {
    document.querySelectorAll('.prefix-telefon-llista:not(.hidden)').forEach((llista) => {
      const contenidorPrefix = llista.closest('.prefix-telefon');
      if (contenidorPrefix && !contenidorPrefix.contains(evt.target)) tancarPrefixTelefon(contenidorPrefix);
    });
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      document.querySelectorAll('.prefix-telefon-llista:not(.hidden)').forEach((llista) => {
        tancarPrefixTelefon(llista.closest('.prefix-telefon'));
      });
    }
  });
  document.getElementById('btn-comprar').addEventListener('click', comprovarAccesAdmin, true);
  document.getElementById('form-compra').addEventListener('submit', enviarFormulari);
  document.getElementById('btn-tornar-selector').addEventListener('click', tornarAlSelector);
  document.getElementById('cantidad').addEventListener('input', () => {
    actualitzarAcompanyants();
    actualitzarPreu();
  });
  document.getElementById('btn-cantidad-menys').addEventListener('click', () => canviarCantidad(-1));
  document.getElementById('btn-cantidad-mes').addEventListener('click', () => canviarCantidad(1));
  actualitzarEstatStepperCantidad();
  actualitzarAcompanyants();
});
