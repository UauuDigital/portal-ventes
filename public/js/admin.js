// Funcions auxiliars i logica del panell d'administracio.

// Botons de fletxa per desplaçar horitzontalment les taules amb scroll
// (en lloc de dependre de la barra nativa del navegador, que en alguns
// entorns no es veu bé ni es pot agafar amb precisió). Es mostren només
// quan la taula realment no hi cap sencera, i es refan si canvia la mida
// de la finestra o el contingut.
function inicialitzarBotonsScrollTaules() {
  document.querySelectorAll('.admin-table-scroll').forEach((contenidor) => {
    if (contenidor.dataset.botonsScrollLlestos) {
      actualitzarBotonsScrollTaula(contenidor);
      return;
    }
    contenidor.dataset.botonsScrollLlestos = '1';
    contenidor.classList.add('amb-botons-scroll');

    const btnEsquerra = document.createElement('button');
    btnEsquerra.type = 'button';
    btnEsquerra.className = 'btn-scroll-taula btn-scroll-taula--esquerra';
    btnEsquerra.setAttribute('aria-label', 'Desplaça la taula cap a l\'esquerra');
    btnEsquerra.textContent = '‹';

    const btnDreta = document.createElement('button');
    btnDreta.type = 'button';
    btnDreta.className = 'btn-scroll-taula btn-scroll-taula--dreta';
    btnDreta.setAttribute('aria-label', 'Desplaça la taula cap a la dreta');
    btnDreta.textContent = '›';

    btnEsquerra.addEventListener('click', () => {
      contenidor.scrollLeft -= 160;
    });
    btnDreta.addEventListener('click', () => {
      contenidor.scrollLeft += 160;
    });

    contenidor.insertAdjacentElement('beforebegin', btnEsquerra);
    contenidor.insertAdjacentElement('afterend', btnDreta);

    // Embolcallem contenidor + botons perquè es puguin posicionar junts.
    const embolcall = document.createElement('div');
    embolcall.className = 'admin-table-scroll-embolcall';
    contenidor.parentNode.insertBefore(embolcall, btnEsquerra);
    embolcall.appendChild(btnEsquerra);
    embolcall.appendChild(contenidor);
    embolcall.appendChild(btnDreta);

    contenidor.addEventListener('scroll', () => actualitzarBotonsScrollTaula(contenidor));
    actualitzarBotonsScrollTaula(contenidor);
  });
}

function actualitzarBotonsScrollTaula(contenidor) {
  const embolcall = contenidor.parentElement;
  const btnEsquerra = embolcall.querySelector('.btn-scroll-taula--esquerra');
  const btnDreta = embolcall.querySelector('.btn-scroll-taula--dreta');
  if (!btnEsquerra || !btnDreta) return;

  const hiHaOverflow = contenidor.scrollWidth > contenidor.clientWidth + 1;
  embolcall.classList.toggle('amb-overflow', hiHaOverflow);
  btnEsquerra.disabled = contenidor.scrollLeft <= 0;
  btnDreta.disabled = contenidor.scrollLeft + contenidor.clientWidth >= contenidor.scrollWidth - 1;
}

document.addEventListener('DOMContentLoaded', () => {
  inicialitzarBotonsScrollTaules();
  window.addEventListener('resize', inicialitzarBotonsScrollTaules);
});

// Es torna a comprovar quan es carreguen dades noves a les taules (per
// exemple en canviar de mida les columnes un cop hi ha files reals).
const observadorTaules = new MutationObserver(() => inicialitzarBotonsScrollTaules());
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.admin-table-scroll tbody').forEach((tbody) => {
    observadorTaules.observe(tbody, { childList: true });
  });
});

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

  activarPestanyaMobil('esdeveniments');
}

// Modal de creacio d'esdeveniment: amagat per defecte, s'obre amb el boto
// del costat del titol "Esdeveniments".
const modalCrearEvento = document.getElementById('modal-crear-evento');
const btnObrirCrear = document.getElementById('btn-obrir-crear');
const btnTancarCrear = document.getElementById('btn-tancar-crear');
const admincolEventos = document.querySelector('.admin-col--eventos');
if (modalCrearEvento && btnObrirCrear && btnTancarCrear) {
  function obrirModalCrear() {
    modalCrearEvento.classList.remove('hidden');
    // Bloqueja la taula de sota mentre el modal és obert perquè cap clic ni
    // hover (per exemple en tancar el modal amb el ratolí quedant just a
    // sobre d'una fila) hi arribi per error.
    if (admincolEventos) admincolEventos.style.pointerEvents = 'none';
    // Mou el focus dins el modal (usuaris de teclat/lector de pantalla no
    // haurien de quedar-se "fora" amb el focus a la pàgina de sota).
    document.getElementById('nombre').focus();
  }
  function tancarModalCrear() {
    modalCrearEvento.classList.add('hidden');
    if (admincolEventos) admincolEventos.style.pointerEvents = '';
    // Retorna el focus al botó que l'ha obert, en lloc de deixar-lo perdut.
    btnObrirCrear.focus();
  }
  btnObrirCrear.addEventListener('click', obrirModalCrear);
  btnTancarCrear.addEventListener('click', (evt) => {
    evt.stopPropagation();
    tancarModalCrear();
  });
  modalCrearEvento.addEventListener('click', (evt) => {
    if (evt.target === modalCrearEvento) tancarModalCrear();
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && !modalCrearEvento.classList.contains('hidden')) tancarModalCrear();
  });
  modalCrearEvento.addEventListener('keydown', (evt) => {
    // Trampa de focus senzilla: Tab/Shift+Tab es queden dins el modal.
    if (evt.key !== 'Tab') return;
    const focusables = modalCrearEvento.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (!focusables.length) return;
    const primer = focusables[0];
    const ultim = focusables[focusables.length - 1];
    if (evt.shiftKey && document.activeElement === primer) {
      evt.preventDefault();
      ultim.focus();
    } else if (!evt.shiftKey && document.activeElement === ultim) {
      evt.preventDefault();
      primer.focus();
    }
  });
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

// Rol de la sessió actual ('admin' | 'viewer'): el personal d'Espai Econòmic
// (viewer) només pot consultar, mai crear/editar/cancel·lar res. El backend
// ja bloqueja aquestes accions independentment d'això; aquí només s'amaguen
// els controls perquè la UI no ofereixi accions que fallarien.
let rolActual = null;
async function aplicarRestriccionsPerRol() {
  const res = await apiFetch('/api/admin/me');
  if (!res || !res.ok) return;
  const { rol } = await res.json();
  rolActual = rol;
  if (rol !== 'viewer') return;

  document.body.classList.add('rol-viewer');
  const btnObrirCrearEl = document.getElementById('btn-obrir-crear');
  if (btnObrirCrearEl) btnObrirCrearEl.style.display = 'none';
  const btnEliminarEl = document.getElementById('btn-eliminar-evento');
  if (btnEliminarEl) btnEliminarEl.style.display = 'none';
  const formEditarEl = document.getElementById('form-evento-editar');
  if (formEditarEl) {
    formEditarEl.querySelectorAll('input, textarea, select, button[type="submit"]').forEach((el) => {
      el.disabled = true;
    });
  }
  const linkExportEl = document.getElementById('link-export-pdf');
  if (linkExportEl) linkExportEl.style.display = 'none';
  const btnEmailProvaEl = document.getElementById('btn-enviar-email-prova');
  if (btnEmailProvaEl) btnEmailProvaEl.style.display = 'none';
}
// Només a les pàgines reals de l'admin (mai a login.html, que no té sessió
// encara i provocaria un bucle de redireccions via el 401 de apiFetch).
if (document.getElementById('btn-logout') && !document.getElementById('form-evento-editar')) {
  document.addEventListener('DOMContentLoaded', aplicarRestriccionsPerRol);
}

function formatEuros(centims) {
  return (centims / 100).toFixed(2) + ' €';
}


function badgeEntradesRestants(ev) {
  const total = ev.aforo_total || 0;
  const ocupades = ev.ocupadas || 0;
  const restants = total - ocupades;
  const percentOcupat = total > 0 ? Math.min(100, Math.max(0, (ocupades / total) * 100)) : 0;

  let modificador = 'normal';
  if (restants <= 0) modificador = 'esgotades';
  else if (restants <= total * 0.1) modificador = 'baixes';

  return `
    <div class="entrades-restants entrades-restants--${modificador}">
      <span class="entrades-restants-numero">${restants}</span>
      <span class="entrades-restants-barra"><span class="entrades-restants-barra-fill" style="width:${percentOcupat}%"></span></span>
    </div>
  `;
}

// Mateixos 4 estats que estado_pago a la BD (config/schema.sql): pendiente
// | pagado | cancelado | reembolsado. Badge discret (mateix patró que
// .admin-historial-badge) només visible amb el toggle "Mostrar totes les
// compres" actiu — amb el filtre per defecte totes dirien "Pagat".
const ESTATS_PAGAMENT_LLEGIBLES = {
  pendiente: 'Pendent',
  pagado: 'Pagat',
  cancelado: 'Cancel·lat',
  reembolsado: 'Reemborsat',
};

function badgeEstatPagament(estat) {
  const text = ESTATS_PAGAMENT_LLEGIBLES[estat] || estat;
  return `<span class="estat-pagament-badge estat-pagament-badge--${escapeAttr(estat)}">${escapeHtml(text)}</span>`;
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

// Igual que escapeHtml, però també escapa les cometes: cal fer-la servir
// quan el valor s'insereix dins un atribut HTML delimitat per cometes
// dobles (p. ex. value="${escapeAttr(valor)}"), perquè escapeHtml sol no
// escapa el caràcter " i una cometa dins el valor trencaria l'atribut.
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Llista dinàmica de convidats/ponents d'un esdeveniment (nom + càrrec,
// sense límit, cal almenys un amb nom per poder desar). S'usa tant al
// formulari de creació (index.html) com al d'edició (evento.html) — per
// això és una funció reutilitzable en lloc de duplicar-la: input(s) en
// línia + botó circular d'eliminar, re-renderitzat sencer a cada canvi.
// Sempre hi ha almenys una fila visible (el botó d'eliminar es desactiva
// a l'última): la validació de "cal almenys un" es fa igualment abans
// d'enviar, per si l'única fila es deixa sense nom.
function crearGestorInvitados(idContenidor) {
  const cont = document.getElementById(idContenidor);
  let invitados = [{ nombre: '', cargo: '' }];

  function render() {
    cont.innerHTML = '';
    invitados.forEach((inv, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-invitat';
      fila.innerHTML = `
        <input type="text" placeholder="Nom" aria-label="Nom del convidat" value="${escapeAttr(inv.nombre)}" data-camp="nombre" data-i="${i}">
        <input type="text" placeholder="Càrrec (opcional)" aria-label="Càrrec del convidat" value="${escapeAttr(inv.cargo)}" data-camp="cargo" data-i="${i}">
        <button type="button" data-i="${i}" aria-label="Elimina aquest convidat" ${invitados.length === 1 ? 'disabled' : ''}>✕</button>
      `;
      cont.appendChild(fila);
    });

    cont.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        invitados[parseInt(input.dataset.i, 10)][input.dataset.camp] = input.value;
      });
    });
    cont.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (invitados.length <= 1) return;
        invitados.splice(parseInt(btn.dataset.i, 10), 1);
        render();
      });
    });
  }

  render();

  return {
    afegir() {
      invitados.push({ nombre: '', cargo: '' });
      render();
    },
    // Carrega una llista existent (edició) o la reinicialitza a una fila
    // buida (formulari nou / després de crear amb èxit).
    carregar(llista) {
      invitados = Array.isArray(llista) && llista.length
        ? llista.map((inv) => ({ nombre: inv.nombre || '', cargo: inv.cargo || '' }))
        : [{ nombre: '', cargo: '' }];
      render();
    },
    // Només els que tenen nom (les files buides s'ignoren), retallats d'espais.
    obtenirValid() {
      return invitados
        .map((inv) => ({ nombre: inv.nombre.trim(), cargo: inv.cargo.trim() }))
        .filter((inv) => inv.nombre);
    },
  };
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
          <div>Places comprades: <strong>${ev.ocupadas || 0}</strong></div>
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

// En passar el cursor per la taula o pel calendari, ressalta l'altra
// representació del mateix esdeveniment perquè quedi clar que són el mateix.
function marcarEventoVinculat(id, actiu) {
  document.querySelectorAll(`tr[data-evento-id="${id}"]`).forEach((tr) => {
    tr.classList.toggle('admin-table-row--vinculat', actiu);
  });
  document.querySelectorAll('.calendari-event').forEach((marcador) => {
    const ids = (marcador.dataset.eventosIds || '').split(',');
    if (ids.includes(String(id))) {
      marcador.classList.toggle('calendari-event--vinculat', actiu);
    }
  });
}

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
      marcador.className = `calendari-dia-numero calendari-event objectiu-tactil calendari-event--${colorPrincipal}` + (clauDia === avui ? ' calendari-event--avui' : '');
      marcador.textContent = dia;
      marcador.dataset.eventosIds = eventosDia.map((ev) => ev.id).join(',');
      marcador.setAttribute('aria-label', eventosDia.map((ev) => ev.nombre).join(', '));
      marcador.addEventListener('mouseenter', () => eventosDia.forEach((ev) => marcarEventoVinculat(ev.id, true)));
      marcador.addEventListener('mouseleave', () => eventosDia.forEach((ev) => marcarEventoVinculat(ev.id, false)));
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

const btnCalendariAvui = document.getElementById('calendari-avui');
if (btnCalendariAvui) {
  btnCalendariAvui.addEventListener('click', () => {
    amagarTooltipCalendari();
    const avui = new Date();
    calendariMesVisible = new Date(avui.getFullYear(), avui.getMonth(), 1);
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
      tr.dataset.eventoId = ev.id;
      tr.innerHTML = `
        <td><span>${escapeHtml(ev.nombre)}</span></td>
        <td><span>${formatData(ev.fecha)}</span></td>
        <td><span>${formatEuros(ev.precio)}</span></td>
        <td><span>${ev.aforo_total}</span></td>
        <td>${badgeEntradesRestants(ev)}</td>
      `;
      tr.addEventListener('click', () => {
        window.location.href = `/admin/evento.html?id=${ev.id}`;
      });
      tr.addEventListener('mouseenter', () => {
        if (calendariGraella && calendariMesVisible) {
          const dataEvento = new Date(ev.fecha);
          if (dataEvento.getFullYear() !== calendariMesVisible.getFullYear() || dataEvento.getMonth() !== calendariMesVisible.getMonth()) {
            calendariMesVisible = new Date(dataEvento.getFullYear(), dataEvento.getMonth(), 1);
            renderCalendari(ultimsEventosCalendari);
          }
        }
        marcarEventoVinculat(ev.id, true);
      });
      tr.addEventListener('mouseleave', () => marcarEventoVinculat(ev.id, false));
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

  const gestorInvitatsCrear = crearGestorInvitados('llista-invitats');
  document.getElementById('btn-afegir-invitat').addEventListener('click', () => gestorInvitatsCrear.afegir());

  formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento');
    errorEl.textContent = '';

    const fechaEventoInput = document.getElementById('fecha');
    if (!fechaEventoInput.dataset.valor) {
      errorEl.textContent = "Tria la data de l'esdeveniment.";
      return;
    }

    const invitados = gestorInvitatsCrear.obtenirValid();
    if (invitados.length === 0) {
      errorEl.textContent = 'Cal almenys un convidat amb nom.';
      return;
    }

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(fechaEventoInput.dataset.valor || fechaEventoInput.value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      invitados,
    };

    const res = await apiFetch('/api/admin/eventos', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      formEvento.reset();
      delete fechaEventoInput.dataset.valor;
      document.getElementById('preview-limit-compra').textContent = '';
      gestorInvitatsCrear.carregar([]);
      carregarEventos();
      renderMiniCalendari();
      if (modalCrearEvento) tancarModalCrear();
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  carregarEventos();
}

// Mini-calendari per triar la "Data de l'esdeveniment" al formulari de
// creació. La data límit de compra ja NO es tria aquí (abans hi havia un
// segon "mode" del calendari per fer-ho): es calcula sempre al backend com
// 48h abans de l'esdeveniment (calcularFechaLimiteCompra, vegeu
// utils/eventoConfig.js). El que es veu sota el camp és només una
// previsualització de només lectura, recalculada en triar cada dia — el
// valor que compta de debò el torna a calcular el backend igualment.
const limitGraella = document.getElementById('limit-graella');
if (limitGraella) {
  let calMesVisible = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const inputFecha = document.getElementById('fecha');
  const previewLimit = document.getElementById('preview-limit-compra');
  const miniCalendari = document.getElementById('mini-calendari-limit');
  const campAmbMinicalendari = document.querySelector('.camp-amb-minicalendari');

  function inicioDia(data) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate());
  }

  // El valor "de veritat" (format YYYY-MM-DDTHH:mm, com abans el datetime-local)
  // es guarda a data-valor; el que es veu al camp és un text llegible, ja
  // que ara és un input de només lectura sense el selector natiu del
  // navegador (tot es tria amb el nostre calendari + selector d'hora).
  function valorInput(input) {
    const cru = input.dataset.valor;
    const raw = cru ? new Date(cru) : null;
    return raw && !Number.isNaN(raw.getTime()) ? raw : null;
  }

  function formatVisual(any, mes, dia, hora) {
    const dataText = new Date(any, mes, dia).toLocaleDateString('ca-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${dataText}, ${hora}`;
  }

  const inputHora = document.getElementById('mini-calendari-hora-input');

  function omplirCampData(input, any, mes, dia, horaPerDefecte) {
    const horaActual = inputHora.value || horaPerDefecte;
    const pad = (n) => String(n).padStart(2, '0');
    input.dataset.valor = `${any}-${pad(mes + 1)}-${pad(dia)}T${horaActual}`;
    input.value = formatVisual(any, mes, dia, horaActual);
    inputHora.value = horaActual;
  }

  function actualitzarPreviewLimit() {
    const dataEvento = valorInput(inputFecha);
    if (!dataEvento) {
      previewLimit.textContent = '';
      return;
    }
    const limit = new Date(dataEvento.getTime() - 48 * 3600 * 1000);
    previewLimit.textContent = `Data límit de compra: ${formatData(limit.toISOString())} (calculada automàticament, 48h abans de l'esdeveniment).`;
  }

  // Canviar l'hora actualitza a l'instant el camp (si ja té data triada),
  // sense necessitat de tornar a clicar cap dia del calendari.
  inputHora.addEventListener('input', () => {
    const cru = inputFecha.dataset.valor;
    if (cru && cru.includes('T') && inputHora.value) {
      const [any, mes, dia] = cru.split('T')[0].split('-').map(Number);
      inputFecha.dataset.valor = `${cru.split('T')[0]}T${inputHora.value}`;
      inputFecha.value = formatVisual(any, mes - 1, dia, inputHora.value);
      actualitzarPreviewLimit();
    }
  });

  function renderMiniCalendari() {
    const avui = inicioDia(new Date());
    const seleccionatRaw = valorInput(inputFecha);
    const seleccionat = seleccionatRaw ? clauData(seleccionatRaw) : null;

    inputHora.value = inputFecha.dataset.valor ? inputFecha.dataset.valor.split('T')[1] : '20:00';

    const any = calMesVisible.getFullYear();
    const mes = calMesVisible.getMonth();
    document.getElementById('limit-mes-actual').textContent = calMesVisible.toLocaleDateString('ca-ES', {
      month: 'long',
      year: 'numeric',
    });

    const primerDiaMes = new Date(any, mes, 1);
    const offsetInicial = (primerDiaMes.getDay() + 6) % 7;
    const diesAlMes = new Date(any, mes + 1, 0).getDate();

    limitGraella.innerHTML = '';

    for (let i = 0; i < offsetInicial; i++) {
      const buit = document.createElement('div');
      buit.className = 'calendari-dia calendari-dia--buit';
      limitGraella.appendChild(buit);
    }

    for (let dia = 1; dia <= diesAlMes; dia++) {
      const data = new Date(any, mes, dia);
      const clau = clauData(data);
      const foraDeRang = data < avui;

      const classes = ['calendari-dia'];
      if (foraDeRang) classes.push('calendari-dia--fora-rang');
      if (clau === seleccionat) classes.push('calendari-dia--seleccionat');

      const cella = document.createElement('div');
      cella.className = classes.join(' ');

      if (foraDeRang) {
        cella.innerHTML = `<span class="calendari-dia-numero">${dia}</span>`;
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendari-dia-numero';
        btn.textContent = dia;
        btn.addEventListener('click', () => {
          omplirCampData(inputFecha, any, mes, dia, '20:00');
          renderMiniCalendari();
          actualitzarPreviewLimit();
          amagarMiniCalendari();
        });
        cella.appendChild(btn);
      }

      limitGraella.appendChild(cella);
    }
  }

  document.getElementById('limit-mes-anterior').addEventListener('click', () => {
    calMesVisible.setMonth(calMesVisible.getMonth() - 1);
    renderMiniCalendari();
  });
  document.getElementById('limit-mes-seguent').addEventListener('click', () => {
    calMesVisible.setMonth(calMesVisible.getMonth() + 1);
    renderMiniCalendari();
  });

  function obrirCalendari() {
    const referencia = valorInput(inputFecha);
    calMesVisible = referencia
      ? new Date(referencia.getFullYear(), referencia.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    renderMiniCalendari();
    miniCalendari.classList.remove('hidden');
  }

  function amagarMiniCalendari() {
    miniCalendari.classList.add('hidden');
  }

  inputFecha.addEventListener('focus', obrirCalendari);
  inputFecha.addEventListener('click', obrirCalendari);
  miniCalendari.addEventListener('click', (evt) => evt.stopPropagation());
  document.getElementById('btn-tancar-mini-calendari').addEventListener('click', amagarMiniCalendari);
  document.addEventListener('click', (evt) => {
    if (!campAmbMinicalendari.contains(evt.target)) {
      amagarMiniCalendari();
    }
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') amagarMiniCalendari();
  });
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

  const gestorInvitatsEditar = crearGestorInvitados('llista-invitats');
  document.getElementById('btn-afegir-invitat').addEventListener('click', () => gestorInvitatsEditar.afegir());

  // Avís propi (no beforeunload natiu, expressament exclòs: això és
  // navegació dins l'admin, no tancar la pestanya) en sortir de l'edició
  // amb canvis sense desar. `hiHaCanvisSenseDesar` es marca a true amb
  // qualsevol canvi als camps de l'esdeveniment (incloent afegir/eliminar
  // convidats) i es reinicialitza a false just després de carregar les
  // dades (perquè omplir el formulari no compti com "un canvi") i després
  // de desar amb èxit.
  let hiHaCanvisSenseDesar = false;
  function marcarCanvisSenseDesar() {
    hiHaCanvisSenseDesar = true;
  }
  ['nombre', 'fecha', 'descripcion', 'estado', 'email_asunto', 'email_html'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', marcarCanvisSenseDesar);
    el.addEventListener('change', marcarCanvisSenseDesar);
  });
  // Els inputs de nom/càrrec de cada convidat es recreen a cada render()
  // (crearGestorInvitados): delegat sobre el contenidor estable en lloc de
  // re-enganxar el listener a cada fila nova. Els botons (afegir/eliminar
  // convidat) no disparen input/change, per això cal 'click' a part.
  document.getElementById('llista-invitats').addEventListener('input', marcarCanvisSenseDesar);
  document.getElementById('llista-invitats').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') marcarCanvisSenseDesar();
  });
  document.getElementById('btn-afegir-invitat').addEventListener('click', marcarCanvisSenseDesar);

  const modalCanvis = document.getElementById('modal-canvis-sense-desar');
  const linkTornar = document.getElementById('link-tornar-esdeveniments');
  let urlSortidaPendent = null;

  function obrirModalCanvis(url) {
    urlSortidaPendent = url;
    modalCanvis.classList.remove('hidden');
  }
  function tancarModalCanvis() {
    modalCanvis.classList.add('hidden');
    urlSortidaPendent = null;
  }

  linkTornar.addEventListener('click', (e) => {
    if (hiHaCanvisSenseDesar) {
      e.preventDefault();
      obrirModalCanvis(linkTornar.href);
    }
  });
  document.getElementById('btn-canvis-quedar').addEventListener('click', tancarModalCanvis);
  document.getElementById('btn-canvis-sortir').addEventListener('click', () => {
    if (urlSortidaPendent) window.location.href = urlSortidaPendent;
  });
  modalCanvis.addEventListener('click', (e) => {
    if (e.target === modalCanvis) tancarModalCanvis();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalCanvis.classList.contains('hidden')) tancarModalCanvis();
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
    document.getElementById('dades-fixes-evento').textContent =
      `Preu: ${formatEuros(evento.precio)} · Aforament: ${evento.aforo_total} places (fixos, no editables des d'aquí).`;
    document.getElementById('dades-limit-compra').textContent =
      `Data límit de compra: ${formatData(evento.fecha_limite_compra)} (calculada automàticament, 48h abans de l'esdeveniment — no editable).`;
    document.getElementById('estado').value = evento.estado;
    gestorInvitatsEditar.carregar(evento.invitados);
    document.getElementById('email_asunto').value = evento.email_asunto || '';
    document.getElementById('email_html').value = evento.email_html || '';
  }

  // Previsualització de només lectura: es recalcula si l'admin canvia la
  // data de l'esdeveniment (abans de desar). El valor real el torna a
  // calcular el backend en rebre la petició (calcularFechaLimiteCompra a
  // utils/eventoConfig.js), això és només perquè es vegi actualitzat aquí.
  document.getElementById('fecha').addEventListener('input', () => {
    const inputFecha = document.getElementById('fecha').value;
    const dataEvento = new Date(inputFecha);
    if (Number.isNaN(dataEvento.getTime())) return;
    const limit = new Date(dataEvento.getTime() - 48 * 3600 * 1000);
    document.getElementById('dades-limit-compra').textContent =
      `Data límit de compra: ${formatData(limit.toISOString())} (calculada automàticament, 48h abans de l'esdeveniment — no editable).`;
  });

  formEventoEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento-editar');
    errorEl.textContent = '';

    const invitados = gestorInvitatsEditar.obtenirValid();
    if (invitados.length === 0) {
      errorEl.textContent = 'Cal almenys un convidat amb nom.';
      return;
    }

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      estado: document.getElementById('estado').value,
      invitados,
      email_asunto: document.getElementById('email_asunto').value,
      email_html: document.getElementById('email_html').value,
    };

    const res = await apiFetch(`/api/admin/eventos/${eventoId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res) return;

    if (res.ok) {
      hiHaCanvisSenseDesar = false;
      window.location.href = '/admin/index.html';
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  document.getElementById('btn-enviar-email-prova').addEventListener('click', async () => {
    const missatgeEl = document.getElementById('email-prova-missatge');
    const destinatari = document.getElementById('email-prova-destinatari').value.trim();
    missatgeEl.textContent = '';
    missatgeEl.classList.remove('email-prova-ok');

    if (!destinatari) {
      missatgeEl.textContent = 'Indica una adreça de destinatari per a la prova.';
      return;
    }

    const btn = document.getElementById('btn-enviar-email-prova');
    btn.disabled = true;
    const res = await apiFetch(`/api/admin/eventos/${eventoId}/email-prova`, {
      method: 'POST',
      body: JSON.stringify({
        destinatario: destinatari,
        email_asunto: document.getElementById('email_asunto').value,
        email_html: document.getElementById('email_html').value,
      }),
    });
    btn.disabled = false;
    if (!res) return;

    if (res.ok) {
      missatgeEl.textContent = `Email de prova enviat a ${destinatari}.`;
      missatgeEl.classList.add('email-prova-ok');
    } else {
      const data = await res.json();
      missatgeEl.textContent = (data.detalls || [data.error === 'error_enviament_email'
        ? 'No s\'ha pogut enviar l\'email de prova.'
        : data.error]).join(', ');
    }
  });

  const taulaCompras = document.getElementById('taula-compras');
  const filaCapsaleraCompras = document.getElementById('fila-capsalera-compras');
  const totaComprasToggle = document.getElementById('tota-compres-toggle');
  const linkExportPdf = document.getElementById('link-export-pdf');

  // El PDF ha de reflectir sempre el mateix filtre que la taula en aquell
  // moment (pagades per defecte, totes amb el toggle actiu) — es recalcula
  // l'enllaç cada cop que el toggle canvia, no només un cop en carregar.
  function actualitzarLinkExportPdf() {
    if (!linkExportPdf) return;
    const estat = totaComprasToggle && totaComprasToggle.checked ? 'todas' : 'pagado';
    linkExportPdf.href = `/api/admin/eventos/${eventoId}/compras/export.pdf?estado=${estat}`;
  }

  function actualitzarCapsaleraCompras() {
    if (!filaCapsaleraCompras) return;
    filaCapsaleraCompras.querySelectorAll('th[data-estat-col]').forEach((th) => th.remove());
    const thAccions = filaCapsaleraCompras.querySelector('th:last-child');
    // La columna d'estat només aporta res quan la taula pot mostrar
    // compres que no siguin totes "pagado" (toggle "totes" actiu): amb el
    // filtre per defecte, totes les files dirien el mateix.
    if (totaComprasToggle && totaComprasToggle.checked) {
      const thEstat = document.createElement('th');
      thEstat.dataset.estatCol = '1';
      thEstat.textContent = 'Estat';
      filaCapsaleraCompras.insertBefore(thEstat, thAccions);
    }
  }

  async function carregarCompras() {
    const mostrarTotes = !!(totaComprasToggle && totaComprasToggle.checked);
    const res = await apiFetch(`/api/admin/eventos/${eventoId}/compras?estado=${mostrarTotes ? 'todas' : 'pagado'}`);
    if (!res) return;
    const compras = await res.json();
    actualitzarCapsaleraCompras();
    taulaCompras.innerHTML = '';
    // Nombre de columnes de la taula (per al colspan de la fila de detall
    // dels acompanyants): comprador/email/telèfon/quantitat/import/data (6)
    // + la columna d'estat (només amb el toggle actiu) + la columna d'accions.
    const numColumnes = 6 + (mostrarTotes ? 1 : 0) + 1;
    compras.forEach((c) => {
      const potCancelar = ['pendiente', 'pagado'].includes(c.estado_pago) && rolActual !== 'viewer';
      const tdEstat = mostrarTotes ? `<td>${badgeEstatPagament(c.estado_pago)}</td>` : '';
      const teAcompanyants = Array.isArray(c.acompanyants) && c.acompanyants.length > 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.nombre_comprador)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.telefono || '—')}</td>
        <td>${teAcompanyants
          ? `<button type="button" class="btn-veure-acompanyants" data-id="${c.id}" aria-expanded="false" aria-controls="acompanyants-detall-${c.id}">${c.cantidad} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
          : c.cantidad}</td>
        <td>${formatEuros(c.importe_total)}</td>
        <td>${formatData(c.created_at)}</td>
        ${tdEstat}
        <td>${potCancelar ? `<button type="button" class="btn-cancelar-compra" data-id="${c.id}">Cancel·lar</button>` : ''}</td>
      `;
      taulaCompras.appendChild(tr);

      // Fila de detall amagada, plegada per defecte: només informativa
      // (nom/email/telèfon de cada acompanyant), no editable des d'aquí.
      if (teAcompanyants) {
        const trDetall = document.createElement('tr');
        trDetall.className = 'fila-acompanyants hidden';
        trDetall.id = `acompanyants-detall-${c.id}`;
        trDetall.innerHTML = `
          <td colspan="${numColumnes}">
            <div class="acompanyants-detall">
              <p class="acompanyants-detall-titol">Acompanyants</p>
              ${c.acompanyants.map((ac) => `
                <p class="acompanyants-detall-fila">
                  <strong>${escapeHtml(ac.nombre)}</strong>
                  <span>${escapeHtml(ac.email)}</span>
                  ${ac.telefono ? `<span>${escapeHtml(ac.telefono)}</span>` : ''}
                </p>
              `).join('')}
            </div>
          </td>
        `;
        taulaCompras.appendChild(trDetall);
      }
    });

    taulaCompras.querySelectorAll('.btn-cancelar-compra').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res2 = await apiFetch(`/api/admin/compras/${btn.dataset.id}/cancelar`, { method: 'POST' });
        if (res2 && res2.ok) carregarCompras();
      });
    });

    taulaCompras.querySelectorAll('.btn-veure-acompanyants').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fila = document.getElementById(`acompanyants-detall-${btn.dataset.id}`);
        if (!fila) return;
        const obert = !fila.classList.contains('hidden');
        fila.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', String(!obert));
      });
    });
  }

  if (totaComprasToggle) {
    totaComprasToggle.addEventListener('change', () => {
      actualitzarLinkExportPdf();
      carregarCompras();
    });
  }
  actualitzarLinkExportPdf();

  // Espera a conèixer el rol abans de pintar les compres, perquè el botó
  // "Cancel·lar" no aparegui un instant per després desaparèixer.
  aplicarRestriccionsPerRol().then(async () => {
    await carregarEvento();
    // Omplir el formulari amb les dades carregades no compta com "un
    // canvi" — es reinicialitza aquí, després que carregarEvento() ja hagi
    // assignat tots els valors (i disparat qualsevol event que això comporti).
    hiHaCanvisSenseDesar = false;
    carregarCompras();
  });
}
