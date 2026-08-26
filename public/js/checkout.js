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

/** Uneix el prefix de país triat amb el número, en un sol camp de text
 * (p. ex. "+34 612345678"), tal com espera el backend. Si no s'ha escrit
 * cap número, no s'envia prefix sol. */
function combinarTelefonAmbPrefix() {
  const numero = document.getElementById('telefono').value.trim();
  if (!numero) return '';
  const prefix = document.getElementById('prefix_telefono').value;
  return `${prefix} ${numero}`;
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

function inicialitzarPrefixTelefon() {
  const contenidor = document.getElementById('prefix-telefon');
  if (!contenidor) return;

  const btn = document.getElementById('prefix-telefon-btn');
  const llista = document.getElementById('prefix-telefon-llista');
  const inputAmagat = document.getElementById('prefix_telefono');
  const spanBandera = document.getElementById('prefix-telefon-bandera');
  const spanCodi = document.getElementById('prefix-telefon-codi');

  llista.innerHTML = PAISOS_PREFIX.map(
    (p, i) => `
      <li role="option" data-iso="${p.iso}" data-codi="${p.codi}" data-index="${i}" tabindex="-1">
        <span class="prefix-telefon-opcio-bandera">${BANDERES[p.iso]}</span>
        <span class="prefix-telefon-opcio-nom">${p.nom}</span>
        <span class="prefix-telefon-opcio-codi">${p.codi}</span>
      </li>
    `
  ).join('');
  spanBandera.innerHTML = BANDERES.ES;
  btn.setAttribute('aria-label', `Prefix telefònic: Espanya, +34`);

  function obrir() {
    llista.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  }
  function tancar() {
    llista.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  }
  function triar(opcioEl) {
    const nomPais = opcioEl.querySelector('.prefix-telefon-opcio-nom').textContent;
    spanBandera.innerHTML = BANDERES[opcioEl.dataset.iso];
    spanCodi.textContent = opcioEl.dataset.codi;
    inputAmagat.value = opcioEl.dataset.codi;
    btn.setAttribute('aria-label', `Prefix telefònic: ${nomPais}, ${opcioEl.dataset.codi}`);
    tancar();
  }

  btn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    llista.classList.contains('hidden') ? obrir() : tancar();
  });
  llista.addEventListener('click', (evt) => {
    const opcio = evt.target.closest('li');
    if (opcio) triar(opcio);
  });
  document.addEventListener('click', (evt) => {
    if (!contenidor.contains(evt.target)) tancar();
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') tancar();
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
  renderCampsFormulariDinamics(ev.campos_formulario || []);
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

let campsFormulariActuals = [];

function renderCampsFormulariDinamics(campos) {
  campsFormulariActuals = campos;
  const cont = document.getElementById('camps-formulari-dinamics');
  cont.innerHTML = '';
  campos.forEach((campo) => {
    const wrap = document.createElement('div');
    wrap.className = 'camp-dinamic';

    if (campo.tipo === 'texto') {
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</label>
        <input type="text" id="camp_${campo.id}" ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'numero') {
      const min = campo.min !== undefined ? `min="${campo.min}"` : '';
      const max = campo.max !== undefined ? `max="${campo.max}"` : '';
      const unitat = campo.unidad ? ` (${escapeHtml(campo.unidad)})` : '';
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${unitat}${campo.requerido ? ' *' : ''}</label>
        <input type="number" id="camp_${campo.id}" ${min} ${max} ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'seleccion') {
      const inputType = campo.multiple ? 'checkbox' : 'radio';
      const opcions = (campo.opciones || []).map((op, i) => `
        <label class="opcio-dinamica">
          <input type="${inputType}" name="camp_${campo.id}" value="${escapeAttr(op)}" ${campo.requerido && !campo.multiple ? 'required' : ''}>
          ${escapeHtml(op)}
        </label>
      `).join('');
      wrap.innerHTML = `<span class="camp-dinamic-etiqueta">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</span>${opcions}`;
    }

    cont.appendChild(wrap);
  });
}

// Acompanyants: apareixen/creixen quan "Nombre de places" (cantidad) és
// més gran d'1 — cal exactament cantidad - 1 (el comprador principal ja
// compta com a 1 plaça, ell no s'hi repeteix). L'array es manté persistent
// entre canvis de cantidad: si es puja de 2 a 3 s'afegeix una fila buida
// al final; si es baixa de 3 a 2 es descarta només l'última, sense tocar
// les dades ja escrites a les que es mantenen.
//
// Es mostren com una única targeta amb pestanyes numerades (1, 2, 3...) en
// comptes d'apilar-los tots verticalment: només l'acompanyant de la
// pestanya activa té els seus <input> al DOM en cada moment. Per això,
// a diferència del comprador principal (que sí és sempre visible i es pot
// validar només amb required/type=email natius), aquí cal una validació
// pròpia en JS abans d'enviar — si no, les dades d'una pestanya no visible
// no es comprovarien mai.
let acompanyantsActuals = [];
let acompanyantTabActiva = 0;
// Es marca a true només després d'un intent d'enviament que ha fallat per
// dades d'acompanyants invàlides, perquè el punt vermell no aparegui abans
// que l'usuari hagi ni intentat enviar el formulari.
let intentAcompanyantsFallit = false;

// Mateixa regex que utils/validacio.js (EMAIL_REGEX) al backend, perquè el
// criteri de "email vàlid" no divergeixi entre el que s'ensenya aquí i el
// que de veritat exigeix el servidor.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function acompanyantInvalid(ac) {
  return !ac.nombre.trim() || !EMAIL_REGEX.test(ac.email.trim());
}

function renderAcompanyants(n) {
  const cont = document.getElementById('acompanyants-dinamics');

  while (acompanyantsActuals.length < n) acompanyantsActuals.push({ nombre: '', email: '', telefono: '' });
  acompanyantsActuals.length = n;

  if (n === 0) {
    cont.innerHTML = '';
    acompanyantTabActiva = 0;
    return;
  }

  // Si la pestanya activa deixa d'existir (p. ex. cantidad baixa estant a
  // la pestanya 3 i ara només n'hi ha 2), es passa a l'última vàlida.
  if (acompanyantTabActiva > n - 1) acompanyantTabActiva = n - 1;

  const ac = acompanyantsActuals[acompanyantTabActiva];
  cont.innerHTML = `
    <p class="acompanyants-titol">Dades dels acompanyants</p>
    <div class="acompanyants-pestanyes" role="tablist">
      ${acompanyantsActuals.map((item, i) => `
        <button type="button" class="acompanyant-pestanya${i === acompanyantTabActiva ? ' acompanyant-pestanya--activa' : ''}${intentAcompanyantsFallit && acompanyantInvalid(item) ? ' acompanyant-pestanya--error' : ''}"
          role="tab" aria-selected="${i === acompanyantTabActiva}" data-i="${i}">${i + 1}</button>
      `).join('')}
    </div>
    <div class="acompanyant-targeta">
      <p class="acompanyant-subtitol">Acompanyant ${acompanyantTabActiva + 1}</p>
      <label for="acompanyant_nom">Nom i cognoms</label>
      <input type="text" id="acompanyant_nom" data-camp="nombre" value="${escapeAttr(ac.nombre)}" required>
      <label for="acompanyant_email">Email</label>
      <input type="email" id="acompanyant_email" data-camp="email" value="${escapeAttr(ac.email)}" required>
      <label for="acompanyant_telefon">Telèfon</label>
      <input type="tel" id="acompanyant_telefon" data-camp="telefono" value="${escapeAttr(ac.telefono)}">
    </div>
  `;

  cont.querySelectorAll('.acompanyant-pestanya').forEach((btn) => {
    btn.addEventListener('click', () => {
      acompanyantTabActiva = parseInt(btn.dataset.i, 10);
      renderAcompanyants(acompanyantsActuals.length);
    });
  });

  cont.querySelectorAll('input[data-camp]').forEach((input) => {
    input.addEventListener('input', () => {
      acompanyantsActuals[acompanyantTabActiva][input.dataset.camp] = input.value;
      // Repinta només els indicadors de les pestanyes (no la targeta, per
      // no perdre el focus/cursor de l'input on l'usuari està escrivint)
      // perquè el punt vermell desaparegui a l'instant en corregir-se.
      if (intentAcompanyantsFallit) {
        cont.querySelectorAll('.acompanyant-pestanya').forEach((btn, i) => {
          btn.classList.toggle('acompanyant-pestanya--error', acompanyantInvalid(acompanyantsActuals[i]));
        });
      }
    });
  });
}

function actualitzarAcompanyants() {
  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;
  renderAcompanyants(Math.max(0, cantidad - 1));
}

// Preu de la fitxa: es repinta amb el preu unitari de l'evento (precioUnitari)
// multiplicat per "Nombre de places". El preu real cobrat es calcula al
// backend (crearCheckoutSession); això és només reflex visual.
function actualitzarPreu() {
  if (!precioUnitari) return;
  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;
  document.getElementById('evento-preu').textContent = formatEuros(cantidad * precioUnitari);
}

function llegirRespostesCampsDinamics() {
  const respostes = {};
  campsFormulariActuals.forEach((campo) => {
    if (campo.tipo === 'texto') {
      respostes[campo.id] = document.getElementById(`camp_${campo.id}`).value;
    } else if (campo.tipo === 'numero') {
      const v = document.getElementById(`camp_${campo.id}`).value;
      if (v !== '') respostes[campo.id] = parseFloat(v);
    } else if (campo.tipo === 'seleccion') {
      const marcats = Array.from(document.querySelectorAll(`input[name="camp_${campo.id}"]:checked`)).map((i) => i.value);
      respostes[campo.id] = campo.multiple ? marcats : (marcats[0] || '');
    }
  });
  return respostes;
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

async function enviarFormulari(evt) {
  evt.preventDefault();

  const btn = document.getElementById('btn-comprar');
  const errorEl = document.getElementById('error-missatge');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = t('btn_comprar_processant');

  const cantidad = parseInt(document.getElementById('cantidad').value, 10) || 1;

  // Amb la targeta única de pestanyes, només l'acompanyant de la pestanya
  // activa té els inputs al DOM en aquest moment — required/type=email
  // natius només poden validar-lo a ell. Cal comprovar aquí explícitament
  // TOTS els acompanyants (incloses les pestanyes no visibles) abans
  // d'enviar, i si algun falla, saltar a la primera pestanya amb problema
  // perquè l'usuari sàpiga exactament on tornar.
  if (cantidad > 1) {
    const primerInvalid = acompanyantsActuals.slice(0, cantidad - 1).findIndex(acompanyantInvalid);
    if (primerInvalid !== -1) {
      intentAcompanyantsFallit = true;
      acompanyantTabActiva = primerInvalid;
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
    respuestas_campos: llegirRespostesCampsDinamics(),
  };

  // Amb cantidad=1 el cos no porta la clau acompanyants en absolut (el
  // backend tampoc l'exigeix ni la llegeix en aquest cas).
  if (cantidad > 1) {
    body.acompanyants = acompanyantsActuals.slice(0, cantidad - 1).map((ac) => ({
      nombre: ac.nombre.trim(),
      email: ac.email.trim(),
      telefono: ac.telefono.trim(),
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
  inicialitzarPrefixTelefon();
  document.getElementById('btn-comprar').addEventListener('click', comprovarAccesAdmin, true);
  document.getElementById('form-compra').addEventListener('submit', enviarFormulari);
  document.getElementById('btn-tornar-selector').addEventListener('click', tornarAlSelector);
  document.getElementById('cantidad').addEventListener('input', () => {
    actualitzarAcompanyants();
    actualitzarPreu();
  });
  actualitzarAcompanyants();
});
