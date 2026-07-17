let eventoSeleccionatId = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
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
      no_hi_ha_event_actiu: "Ara mateix no hi ha cap esdeveniment obert per a la venda d'entrades.",
      data_limit_superada: 'El termini de compra per a aquest esdeveniment ha finalitzat.',
      aforament_exhaurit: "Les entrades per a aquest esdeveniment s'han esgotat.",
    };
    avis.textContent = motius[data.motiu] || 'La compra no està disponible ara mateix.';
    document.getElementById('evento-data').textContent = '';
    document.getElementById('evento-preu').textContent = '';
    if (data.motiu === 'aforament_exhaurit') {
      document.getElementById('evento-aforo').textContent = '🎟️ Sense places disponibles';
      actualitzarBarraAforo(0, 1);
    } else {
      document.getElementById('evento-aforo').textContent = '';
      document.getElementById('aforo-bar').classList.add('hidden');
    }
    if (data.evento) {
      document.getElementById('evento-nombre').textContent = data.evento.nombre;
      document.getElementById('evento-descripcio').textContent = data.evento.descripcion || '';
    }
    return null;
  }

  const ev = data.evento;
  eventoSeleccionatId = ev.id;
  document.getElementById('evento-nombre').textContent = ev.nombre;
  document.getElementById('evento-descripcio').textContent = ev.descripcion || '';
  document.getElementById('evento-data').textContent = '📅 ' + new Date(ev.fecha).toLocaleString('ca-ES');
  document.getElementById('evento-preu').textContent = '💶 ' + (ev.precio / 100).toFixed(2) + ' € / entrada';
  document.getElementById('evento-aforo').textContent = '🎟️ ' + ev.aforo_disponible + ' places disponibles';
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

function tornarAlSelector() {
  document.getElementById('main-card').classList.add('hidden');
  document.getElementById('selector-esdeveniments').classList.remove('hidden');
}

function renderSelectorEsdeveniments(eventos) {
  const grid = document.getElementById('selector-grid');
  grid.innerHTML = '';
  eventos.forEach((ev) => {
    const { percentOcupat, classe } = calcularAforo(ev.aforo_disponible, ev.aforo_total);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'selector-btn';
    btn.innerHTML = `
      <span class="selector-btn-nom">${escapeHtml(ev.nombre)}</span>
      <span class="selector-btn-data">📅 ${escapeHtml(new Date(ev.fecha).toLocaleString('ca-ES'))}</span>
      <div class="aforo-bar aforo-bar--selector">
        <div class="aforo-bar-fill ${classe}" style="width:${percentOcupat}%"></div>
      </div>
      <span class="selector-btn-aforo">🎟️ ${ev.aforo_disponible} places disponibles</span>
    `;
    btn.addEventListener('click', () => mostrarFormulariEvento(ev.id, true));
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
  btn.textContent = 'Processant…';

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
      errorEl.textContent = data.detalls ? data.detalls.join(', ') : (data.error || 'Error inesperat.');
      btn.disabled = false;
      btn.textContent = 'Pagar i reservar entrada';
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    errorEl.textContent = "No s'ha pogut connectar amb el servidor. Torna-ho a provar.";
    btn.disabled = false;
    btn.textContent = 'Pagar i reservar entrada';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  iniciar();
  document.getElementById('quiere_factura').addEventListener('change', toggleCampsFiscals);
  document.getElementById('btn-comprar').addEventListener('click', comprovarAccesAdmin, true);
  document.getElementById('form-compra').addEventListener('submit', enviarFormulari);
  document.getElementById('btn-tornar-selector').addEventListener('click', tornarAlSelector);
});
