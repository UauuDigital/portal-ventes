// Funcions auxiliars i logica del panell d'administracio.

// Pestanyes mòbil de la pàgina d'esdeveniments (Crear / Esdeveniments / Calendari):
// en mòbil només es veu un panell alhora; en escriptori les tres columnes es
// veuen sempre (el CSS ignora aquestes classes per sobre de 960px).
const pestanyesMobil = document.querySelectorAll('.admin-mobile-tab');
if (pestanyesMobil.length) {
  const panells = document.querySelectorAll('.admin-columns .admin-col[data-panell]');

  function activarPestanyaMobil(nom) {
    pestanyesMobil.forEach((btn) => {
      btn.classList.toggle('admin-mobile-tab--actiu', btn.dataset.tab === nom);
    });
    panells.forEach((panell) => {
      panell.classList.toggle('admin-col--panell-actiu', panell.dataset.panell === nom);
    });
  }

  pestanyesMobil.forEach((btn) => {
    btn.addEventListener('click', () => activarPestanyaMobil(btn.dataset.tab));
  });

  activarPestanyaMobil('crear');
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    return null;
  }
  return res;
}

function formatEuros(centims) {
  return (centims / 100).toFixed(2) + ' €';
}

const ESTATS_EVENTO = { abierto: 'Obert', cerrado: 'Tancat' };
function traduirEstatEvento(estado) {
  return ESTATS_EVENTO[estado] || estado;
}

const ESTATS_PAGO = { pendiente: 'Pendent', pagado: 'Pagat', cancelado: 'Cancel·lat' };
function badgeEstatPago(estado) {
  const etiqueta = ESTATS_PAGO[estado] || estado;
  return `<span class="badge-estat badge-estat--${escapeHtml(estado)}">${escapeHtml(etiqueta)}</span>`;
}

function formatData(isoString) {
  const data = new Date(isoString);
  const dataText = data.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const horaText = data.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  return `${dataText} · ${horaText}`;
}

// Escapa text no fiable abans d'interpolar-lo dins innerHTML, per evitar XSS
// amb dades provinents del formulari public (noms, emails, descripcions, etc.)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
}

// Formulari de login
const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuari = document.getElementById('usuari').value;
    const contrasenya = document.getElementById('contrasenya').value;
    const errorEl = document.getElementById('error-login');
    errorEl.textContent = '';

    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuari, contrasenya }),
    });

    if (res.ok) {
      window.location.href = '/admin/index.html';
    } else {
      errorEl.textContent = 'Usuari o contrasenya incorrectes.';
    }
  });
}

// Boto de tancar sessio
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await fetch('/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });
}

// Calendari d'esdeveniments (columna al costat de la taula)
const calendariGraella = document.getElementById('calendari-graella');
let calendariMesVisible = null; // Date (dia 1 del mes mostrat)
let calendariTooltipEl = null;

function clauData(data) {
  // Clau local (no UTC) per agrupar esdeveniments pel dia de calendari.
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function colorEstatEvento(ev) {
  const ara = new Date();
  if (new Date(ev.fecha) < ara) return 'gris';
  const terminiSuperat = new Date(ev.fecha_limite_compra) <= ara;
  const exhaurit = (ev.ocupadas || 0) >= ev.aforo_total;
  if (terminiSuperat || exhaurit) return 'vermell';
  return 'verd';
}

function amagarTooltipCalendari() {
  if (calendariTooltipEl) {
    calendariTooltipEl.remove();
    calendariTooltipEl = null;
  }
}

function mostrarTooltipCalendari(evt, eventosDia) {
  amagarTooltipCalendari();
  const div = document.createElement('div');
  div.className = 'calendari-tooltip';
  div.innerHTML = eventosDia
    .map(
      (ev, i) => `
        <div>
          <div>${escapeHtml(ev.nombre)}</div>
          <div>Aforament: <strong>${ev.aforo_total}</strong></div>
          <div>Entrades comprades: <strong>${ev.ocupadas || 0}</strong></div>
          <button type="button" class="calendari-tooltip-link" data-evento-id="${ev.id}">Veure detall ›</button>
        </div>
      `
    )
    .join('<hr style="border:none; border-top:1px solid rgba(242,239,238,0.2); margin:6px 0;">');
  document.body.appendChild(div);
  div.addEventListener('click', (evtIntern) => evtIntern.stopPropagation());
  div.querySelectorAll('.calendari-tooltip-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = `/admin/evento.html?id=${btn.dataset.eventoId}`;
    });
  });

  // Posiciona la vinyeta sobre el marcador però sense sortir mai de la
  // pantalla (imprescindible en mòbil, on hi ha poc marge): si no hi ha prou
  // espai per sobre es mostra a sota, i es limita horitzontalment als marges
  // del viewport perquè l'enllaç "Veure detall" sempre quedi tocable.
  const MARGE = 8;
  const rectMarcador = evt.target.getBoundingClientRect();
  const rectTooltip = div.getBoundingClientRect();

  let left = rectMarcador.left + rectMarcador.width / 2 - rectTooltip.width / 2;
  left = Math.min(Math.max(left, MARGE), window.innerWidth - rectTooltip.width - MARGE);

  let top = rectMarcador.top - rectTooltip.height - 10;
  if (top < MARGE) {
    top = rectMarcador.bottom + 10;
  }

  div.style.left = `${left}px`;
  div.style.top = `${top}px`;
  div.style.transform = 'none';
  calendariTooltipEl = div;
}

// Toca/clica a fora de la vinyeta per tancar-la (imprescindible al mòbil,
// que no té "mouseleave").
document.addEventListener('click', () => amagarTooltipCalendari());

// Prioritat de color quan hi ha diversos esdeveniments el mateix dia.
const PRIORITAT_COLOR = { vermell: 0, verd: 1, gris: 2 };

function renderCalendari(eventos) {
  if (!calendariGraella || !calendariMesVisible) return;

  const eventosPerDia = new Map();
  eventos.forEach((ev) => {
    const clau = clauData(new Date(ev.fecha));
    if (!eventosPerDia.has(clau)) eventosPerDia.set(clau, []);
    eventosPerDia.get(clau).push(ev);
  });

  const any = calendariMesVisible.getFullYear();
  const mes = calendariMesVisible.getMonth();

  document.getElementById('calendari-mes-actual').textContent = calendariMesVisible.toLocaleDateString('ca-ES', {
    month: 'long',
    year: 'numeric',
  });

  const primerDiaMes = new Date(any, mes, 1);
  // getDay(): 0=diumenge..6=dissabte -> convertim a índex on 0=dilluns
  const offsetInicial = (primerDiaMes.getDay() + 6) % 7;
  const diesAlMes = new Date(any, mes + 1, 0).getDate();
  const avui = clauData(new Date());

  calendariGraella.innerHTML = '';

  for (let i = 0; i < offsetInicial; i++) {
    const buit = document.createElement('div');
    buit.className = 'calendari-dia calendari-dia--buit';
    calendariGraella.appendChild(buit);
  }

  for (let dia = 1; dia <= diesAlMes; dia++) {
    const clauDia = clauData(new Date(any, mes, dia));
    const cella = document.createElement('div');
    cella.className = 'calendari-dia' + (clauDia === avui ? ' calendari-dia--avui' : '');

    const eventosDia = eventosPerDia.get(clauDia) || [];

    if (eventosDia.length === 0) {
      cella.innerHTML = `<span class="calendari-dia-numero">${dia}</span>`;
    } else {
      const colors = eventosDia.map(colorEstatEvento);
      const colorPrincipal = colors.sort((a, b) => PRIORITAT_COLOR[a] - PRIORITAT_COLOR[b])[0];

      const embolcall = document.createElement('div');
      embolcall.className = 'calendari-event-embolcall';

      const marcador = document.createElement('button');
      marcador.type = 'button';
      marcador.className = `calendari-dia-numero calendari-event calendari-event--${colorPrincipal}`;
      marcador.textContent = dia;
      marcador.setAttribute('aria-label', eventosDia.map((ev) => ev.nombre).join(', '));
      // Nota: NO s'usa mouseenter/mouseleave (hover). Als navegadors mòbils,
      // qualsevol listener de hover en un element fa que el primer toc només
      // "simuli" el hover i calgui un segon toc perquè es disparì el click
      // real — per això tot el comportament (obrir/tancar) es fa amb "click",
      // que funciona igual amb ratolí (desktop) i amb tocs (mòbil).
      marcador.addEventListener('click', (evt) => {
        evt.stopPropagation();
        if (calendariTooltipEl && calendariTooltipEl.dataset.marcadorId === String(dia)) {
          amagarTooltipCalendari();
          return;
        }
        mostrarTooltipCalendari(evt, eventosDia);
        calendariTooltipEl.dataset.marcadorId = String(dia);
      });
      embolcall.appendChild(marcador);

      if (eventosDia.length > 1) {
        const comptador = document.createElement('span');
        comptador.className = 'calendari-event-comptador';
        comptador.textContent = eventosDia.length;
        embolcall.appendChild(comptador);
      }

      cella.appendChild(embolcall);
    }

    calendariGraella.appendChild(cella);
  }
}

const btnMesAnterior = document.getElementById('calendari-mes-anterior');
const btnMesSeguent = document.getElementById('calendari-mes-seguent');
let ultimsEventosCalendari = [];
if (btnMesAnterior && btnMesSeguent) {
  btnMesAnterior.addEventListener('click', () => {
    amagarTooltipCalendari();
    calendariMesVisible.setMonth(calendariMesVisible.getMonth() - 1);
    renderCalendari(ultimsEventosCalendari);
  });
  btnMesSeguent.addEventListener('click', () => {
    amagarTooltipCalendari();
    calendariMesVisible.setMonth(calendariMesVisible.getMonth() + 1);
    renderCalendari(ultimsEventosCalendari);
  });
}

// Llistat i creacio d'esdeveniments
const taulaEventos = document.getElementById('taula-eventos');
if (taulaEventos) {
  async function carregarEventos() {
    const res = await apiFetch('/api/admin/eventos');
    if (!res) return;
    const eventos = await res.json();
    // Esdeveniments futurs primer (per data ascendent), els ja celebrats al final.
    const ara = new Date();
    eventos.sort((a, b) => {
      const aPassat = new Date(a.fecha) < ara;
      const bPassat = new Date(b.fecha) < ara;
      if (aPassat !== bPassat) return aPassat ? 1 : -1;
      return new Date(a.fecha) - new Date(b.fecha);
    });
    taulaEventos.innerHTML = '';
    eventos.forEach((ev) => {
      const tr = document.createElement('tr');
      tr.className = `admin-table-row-link admin-table-row--${colorEstatEvento(ev)}`;
      tr.innerHTML = `
        <td><span>${escapeHtml(ev.nombre)}</span></td>
        <td><span>${formatData(ev.fecha)}</span></td>
        <td>${formatEuros(ev.precio)}</td>
        <td>${ev.aforo_total}</td>
        <td>${escapeHtml(traduirEstatEvento(ev.estado))}</td>
      `;
      tr.addEventListener('click', () => {
        window.location.href = `/admin/evento.html?id=${ev.id}`;
      });
      taulaEventos.appendChild(tr);
    });

    if (calendariGraella) {
      ultimsEventosCalendari = eventos;
      if (!calendariMesVisible) {
        const primerEventFutur = eventos.find((ev) => new Date(ev.fecha) >= new Date());
        const dataBase = primerEventFutur ? new Date(primerEventFutur.fecha) : new Date();
        calendariMesVisible = new Date(dataBase.getFullYear(), dataBase.getMonth(), 1);
      }
      renderCalendari(eventos);
    }
  }

  const formEvento = document.getElementById('form-evento');
  formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento');
    errorEl.textContent = '';

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: new Date(document.getElementById('fecha_limite_compra').value).toISOString(),
    };

    const res = await apiFetch('/api/admin/eventos', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      formEvento.reset();
      carregarEventos();
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  carregarEventos();
}

// Detall, edicio i gestio de compres d'un esdeveniment
function aInputDatetimeLocal(isoString) {
  const data = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

const formEventoEditar = document.getElementById('form-evento-editar');
if (formEventoEditar) {
  const params = new URLSearchParams(window.location.search);
  const eventoId = params.get('id');

  document.getElementById('link-export-csv').href = `/api/admin/eventos/${eventoId}/compras/export.csv`;

  const btnEliminar = document.getElementById('btn-eliminar-evento');
  btnEliminar.addEventListener('click', async () => {
    const errorEl = document.getElementById('error-evento-editar');
    errorEl.textContent = '';

    if (!window.confirm('Segur que vols eliminar aquest esdeveniment? Aquesta acció no es pot desfer.')) {
      return;
    }

    let res = await apiFetch(`/api/admin/eventos/${eventoId}`, { method: 'DELETE' });
    if (!res) return;

    if (res.status === 409) {
      const volForcar = window.confirm(
        'Aquest esdeveniment té compres associades. Si continues, també s\'eliminaran totes les compres registrades. Estàs completament segur?'
      );
      if (!volForcar) return;

      res = await apiFetch(`/api/admin/eventos/${eventoId}?forzar=1`, { method: 'DELETE' });
      if (!res) return;
    }

    if (res.ok) {
      window.location.href = '/admin/index.html';
    } else {
      const data = await res.json();
      errorEl.textContent = data.error || 'No s\'ha pogut eliminar l\'esdeveniment.';
    }
  });

  async function carregarEvento() {
    const res = await apiFetch(`/api/admin/eventos/${eventoId}`);
    if (!res) return;
    if (!res.ok) {
      document.getElementById('titol-evento').textContent = 'Esdeveniment no trobat';
      return;
    }
    const evento = await res.json();
    document.getElementById('titol-evento').textContent = evento.nombre;
    document.getElementById('nombre').value = evento.nombre;
    document.getElementById('fecha').value = aInputDatetimeLocal(evento.fecha);
    document.getElementById('descripcion').value = evento.descripcion || '';
    document.getElementById('precio').value = (evento.precio / 100).toFixed(2);
    document.getElementById('aforo_total').value = evento.aforo_total;
    document.getElementById('fecha_limite_compra').value = aInputDatetimeLocal(evento.fecha_limite_compra);
    document.getElementById('estado').value = evento.estado;
  }

  formEventoEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento-editar');
    errorEl.textContent = '';

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: new Date(document.getElementById('fecha_limite_compra').value).toISOString(),
      estado: document.getElementById('estado').value,
    };

    const res = await apiFetch(`/api/admin/eventos/${eventoId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      window.location.href = '/admin/index.html';
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  const taulaCompras = document.getElementById('taula-compras');

  async function carregarCompras() {
    const res = await apiFetch(`/api/admin/eventos/${eventoId}/compras`);
    if (!res) return;
    const compras = await res.json();
    taulaCompras.innerHTML = '';
    compras.forEach((c) => {
      const potCancelar = ['pendiente', 'pagado'].includes(c.estado_pago);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.nombre_comprador)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${c.cantidad}</td>
        <td>${formatEuros(c.importe_total)}</td>
        <td>${badgeEstatPago(c.estado_pago)}</td>
        <td>${potCancelar ? `<button type="button" class="btn-cancelar-compra" data-id="${c.id}">Cancel·lar</button>` : ''}</td>
      `;
      taulaCompras.appendChild(tr);
    });

    taulaCompras.querySelectorAll('.btn-cancelar-compra').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res2 = await apiFetch(`/api/admin/compras/${btn.dataset.id}/cancelar`, { method: 'POST' });
        if (res2 && res2.ok) carregarCompras();
      });
    });
  }

  carregarEvento();
  carregarCompras();
}
