let eventoSeleccionatId = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
}

function t(clau) {
  return window.i18n ? window.i18n.t(clau) : clau;
}

function localeActual() {
  return window.i18n ? window.i18n.localeActual() : 'ca-ES';
}

async function carregarEvento(eventoId) {
  const url = eventoId ? `/api/evento/actual?id=${eventoId}` : '/api/evento/actual';
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
    if (data.motiu === 'aforament_exhaurit') {
      document.getElementById('evento-aforo').textContent = '🎟️ ' + t('sense_places');
      actualitzarBarraAforo(0, 1);
    } else {
      document.getElementById('evento-aforo').textContent = '';
      document.getElementById('aforo-bar').classList.add('hidden');
    }
    if (data.evento) {
      document.getElementById('evento-nombre').textContent = data.evento.nombre;
      document.getElementById('evento-descripcio').textContent = data.evento.descripcion || '';
    } else {
      document.getElementById('evento-nombre').textContent = 'Espai Econòmic';
      document.getElementById('evento-descripcio').textContent = t('evento_default_desc');
    }
    return null;
  }

  const ev = data.evento;
  eventoSeleccionatId = ev.id;
  document.getElementById('evento-nombre').textContent = ev.nombre;
  document.getElementById('evento-descripcio').textContent = ev.descripcion || '';
  document.getElementById('evento-data').textContent = '📅 ' + new Date(ev.fecha).toLocaleString(localeActual());
  document.getElementById('evento-preu').textContent = '💶 ' + (ev.precio / 100).toFixed(2) + ' €' + t('suffix_entrada');
  document.getElementById('evento-aforo').textContent = '🎟️ ' + ev.aforo_disponible + ' ' + t('places_disponibles');
  actualitzarBarraAforo(ev.aforo_disponible, ev.aforo_total);

  return ev;
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

function actualitzarBarraAforo(disponibles, total) {
  const fill = document.getElementById('aforo-bar-fill');
  const barra = document.getElementById('aforo-bar');
  if (!total) {
    barra.classList.add('hidden');
    return;
  }
  barra.classList.remove('hidden');

  const { percentOcupat, classe } = calcularAforo(disponibles, total);
  fill.style.width = `${percentOcupat}%`;
  fill.classList.remove('aforo-bar-fill--mitja', 'aforo-bar-fill--baixa');
  if (classe) fill.classList.add(classe);
  barra.setAttribute('aria-valuenow', String(Math.round(percentOcupat)));
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
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
      <span class="selector-btn-data">📅 ${escapeHtml(new Date(ev.fecha).toLocaleString(localeActual()))}</span>
      <div class="aforo-bar aforo-bar--selector">
        <div class="aforo-bar-fill ${classe}" style="width:${percentOcupat}%"></div>
      </div>
      <span class="selector-btn-aforo">🎟️ ${ev.aforo_disponible} ${escapeHtml(t('places_disponibles'))}</span>
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
  const res = await fetch('/api/evento/actius');
  const eventos = await res.json();

  if (eventos.length > 1) {
    renderSelectorEsdeveniments(eventos);
    return;
  }

  document.getElementById('main-card').classList.remove('hidden');
  await carregarEvento(eventos.length === 1 ? eventos[0].id : undefined);
}

function toggleCampsFiscals() {
  const checked = document.getElementById('quiere_factura').checked;
  const camps = document.getElementById('camps-fiscals');
  camps.classList.toggle('hidden', !checked);
  ['nif', 'nombre_fiscal', 'direccion_fiscal'].forEach((id) => {
    document.getElementById(id).required = checked;
  });
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

  const body = {
    evento_id: eventoSeleccionatId,
    cantidad: document.getElementById('cantidad').value,
    nombre_comprador: document.getElementById('nombre_comprador').value,
    email: document.getElementById('email').value,
    telefono: document.getElementById('telefono').value,
    quiere_factura: document.getElementById('quiere_factura').checked,
    nif: document.getElementById('nif').value,
    nombre_fiscal: document.getElementById('nombre_fiscal').value,
    direccion_fiscal: document.getElementById('direccion_fiscal').value,
    accepta_condicions: document.getElementById('accepta_condicions').checked,
  };

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
  document.getElementById('quiere_factura').addEventListener('change', toggleCampsFiscals);
  document.getElementById('btn-comprar').addEventListener('click', comprovarAccesAdmin, true);
  document.getElementById('form-compra').addEventListener('submit', enviarFormulari);
  document.getElementById('btn-tornar-selector').addEventListener('click', tornarAlSelector);
});

document.addEventListener('idiomaCanviat', () => {
  if (!document.getElementById('selector-esdeveniments').classList.contains('hidden')) {
    renderSelectorEsdeveniments(ultimsEventosSelector);
  } else if (!document.getElementById('main-card').classList.contains('hidden')) {
    carregarEvento(eventoSeleccionatId || undefined);
  }
});
