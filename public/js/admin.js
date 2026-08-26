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
  const linkExportEl = document.getElementById('link-export-csv');
  if (linkExportEl) linkExportEl.style.display = 'none';
  const btnEmailProvaEl = document.getElementById('btn-enviar-email-prova');
  if (btnEmailProvaEl) btnEmailProvaEl.style.display = 'none';
}
// Només a les pàgines reals de l'admin (mai a login.html, que no té sessió
// encara i provocaria un bucle de redireccions via el 401 de apiFetch).
if (document.getElementById('btn-logout') && !document.getElementById('form-evento-editar')) {
  document.addEventListener('DOMContentLoaded', aplicarRestriccionsPerRol);
}

const ICONA_CADENAT_TANCAT =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICONA_CADENAT_OBERT =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.75-3.5"/></svg>';

// Cadenats de bloqueig de traducció: quan un camp ES/CA/EN es marca com a
// bloquejat, la traducció automàtica del blur d'un altre idioma ja no el
// pot sobreescriure, però l'admin el pot continuar editant a mà sense
// problema.
function inicialitzarBloquejosTraduccio() {
  document.querySelectorAll('.btn-bloqueig-traduccio').forEach((btn) => {
    if (btn.dataset.bloquejInicialitzat) return;
    btn.dataset.bloquejInicialitzat = '1';
    btn.innerHTML = ICONA_CADENAT_OBERT;
    btn.addEventListener('click', () => {
      const bloquejat = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!bloquejat));
      btn.innerHTML = bloquejat ? ICONA_CADENAT_OBERT : ICONA_CADENAT_TANCAT;
      btn.setAttribute(
        'aria-label',
        bloquejat
          ? 'Bloqueja aquesta traducció perquè no es sobreescrigui automàticament'
          : 'Desbloqueja aquesta traducció'
      );
    });
  });
}

function campTraduccioBloquejat(input) {
  const camp = input.closest('.camp-traduccio');
  const btn = camp && camp.querySelector('.btn-bloqueig-traduccio');
  return !!btn && btn.getAttribute('aria-pressed') === 'true';
}

// Traducció en viu del "Nom" de l'esdeveniment: es pot escriure en
// qualsevol dels 3 idiomes i, en sortir del camp, es completen sols els
// altres dos (que després es poden editar sense problema, com qualsevol
// altre camp de text, o bloquejar amb el cadenat perquè no es tornin a
// sobreescriure).
function configurarTraduccioNom(camps) {
  inicialitzarBloquejosTraduccio();
  Object.entries(camps).forEach(([idioma, input]) => {
    if (!input) return;
    input.addEventListener('blur', async () => {
      const text = input.value.trim();
      if (!text) return;
      const res = await apiFetch('/api/admin/traduir-nom', {
        method: 'POST',
        body: JSON.stringify({ nombre: text, idioma }),
      });
      if (!res || !res.ok) return;
      const traduccions = await res.json();
      Object.entries(camps).forEach(([altreIdioma, altreInput]) => {
        if (
          altreIdioma !== idioma &&
          altreInput &&
          traduccions[altreIdioma] &&
          !campTraduccioBloquejat(altreInput)
        ) {
          altreInput.value = traduccions[altreIdioma];
        }
      });
    });
  });
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
// això és una funció reutilitzable en lloc de duplicar-la. Mateix patró
// visual/interacció que la llista d'opcions d'un camp de campos_formulario
// (fila-opcio-camp): input(s) en línia + botó circular d'eliminar,
// re-renderitzat sencer a cada canvi. Sempre hi ha almenys una fila
// visible (el botó d'eliminar es desactiva a l'última): la validació de
// "cal almenys un" es fa igualment abans d'enviar, per si l'única fila es
// deixa sense nom.
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
  configurarTraduccioNom({
    ca: document.getElementById('nombre'),
    es: document.getElementById('nombre_es'),
    en: document.getElementById('nombre_en'),
  });
  configurarTraduccioNom({
    ca: document.getElementById('descripcion'),
    es: document.getElementById('descripcion_es'),
    en: document.getElementById('descripcion_en'),
  });

  const gestorInvitatsCrear = crearGestorInvitados('llista-invitats');
  document.getElementById('btn-afegir-invitat').addEventListener('click', () => gestorInvitatsCrear.afegir());

  formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-evento');
    errorEl.textContent = '';

    const fechaEventoInput = document.getElementById('fecha');
    const fechaLimiteInput = document.getElementById('fecha_limite_compra');
    const fechaLimite = new Date(fechaLimiteInput.dataset.valor || fechaLimiteInput.value);
    if (fechaLimite < new Date()) {
      errorEl.textContent = 'La data límit de compra no pot ser una data ja passada.';
      return;
    }

    const invitados = gestorInvitatsCrear.obtenirValid();
    if (invitados.length === 0) {
      errorEl.textContent = 'Cal almenys un convidat amb nom.';
      return;
    }

    const body = {
      nombre: document.getElementById('nombre').value,
      nombre_es: document.getElementById('nombre_es').value,
      nombre_en: document.getElementById('nombre_en').value,
      fecha: new Date(fechaEventoInput.dataset.valor || fechaEventoInput.value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      descripcion_es: document.getElementById('descripcion_es').value,
      descripcion_en: document.getElementById('descripcion_en').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: fechaLimite.toISOString(),
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
      delete fechaLimiteInput.dataset.valor;
      gestorInvitatsCrear.carregar([]);
      carregarEventos();
      renderCalendariLimit();
      if (modalCrearEvento) tancarModalCrear();
    } else {
      const data = await res.json();
      errorEl.textContent = (data.detalls || [data.error]).join(', ');
    }
  });

  carregarEventos();
}

// Mini-calendari compartit pels camps "Data de l'esdeveniment" i "Data
// límit de compra" (només al formulari de creació): en clicar el primer
// camp s'obre en mode "esdeveniment" (qualsevol dia futur); un cop triat,
// canvia sol a mode "límit" (marca el dia de l'esdeveniment i pinta més
// clar els dies vàlids entremig, deshabilitant la resta) perquè triïs de
// seguida el termini de compra, sense haver d'obrir un segon calendari.
const limitGraella = document.getElementById('limit-graella');
if (limitGraella) {
  let calMesVisible = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let modeCalendari = 'esdeveniment'; // 'esdeveniment' | 'limit'
  const inputFecha = document.getElementById('fecha');
  const inputLimit = document.getElementById('fecha_limite_compra');
  const titolCalendari = document.getElementById('mini-calendari-titol');
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

  // Canviar l'hora actualitza a l'instant el camp actiu (si ja té data
  // triada), sense necessitat de tornar a clicar cap dia del calendari.
  inputHora.addEventListener('input', () => {
    const inputActiu = modeCalendari === 'esdeveniment' ? inputFecha : inputLimit;
    const cru = inputActiu.dataset.valor;
    if (cru && cru.includes('T') && inputHora.value) {
      const [any, mes, dia] = cru.split('T')[0].split('-').map(Number);
      inputActiu.dataset.valor = `${cru.split('T')[0]}T${inputHora.value}`;
      inputActiu.value = formatVisual(any, mes - 1, dia, inputHora.value);
    }
  });

  function renderCalendariLimit() {
    const dataEventoRaw = valorInput(inputFecha);
    const dataEvento = dataEventoRaw ? inicioDia(dataEventoRaw) : null;
    const avui = inicioDia(new Date());
    const inputActiu = modeCalendari === 'esdeveniment' ? inputFecha : inputLimit;
    const seleccionatRaw = valorInput(inputActiu);
    const seleccionat = seleccionatRaw ? clauData(seleccionatRaw) : null;

    inputHora.value = inputActiu.dataset.valor
      ? inputActiu.dataset.valor.split('T')[1]
      : modeCalendari === 'esdeveniment' ? '20:00' : '23:59';

    titolCalendari.textContent =
      modeCalendari === 'esdeveniment' ? "Tria la data de l'esdeveniment" : 'Tria el límit de compra';

    // El botó "Següent" només té sentit en mode "esdeveniment" i un cop ja
    // s'ha triat un dia (perquè abans encara no hi ha res a confirmar).
    document
      .getElementById('mini-calendari-seguent')
      .classList.toggle('hidden', !(modeCalendari === 'esdeveniment' && inputFecha.dataset.valor));

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

      // En mode "esdeveniment" només cal que el dia no hagi passat. En mode
      // "límit" el dia ha d'estar entre avui i el dia de l'esdeveniment.
      const foraDeRang =
        modeCalendari === 'esdeveniment' ? data < avui : data < avui || (dataEvento && data > dataEvento);
      const esMarcat = modeCalendari === 'limit' && dataEvento && data.getTime() === dataEvento.getTime();
      const esInterval = modeCalendari === 'limit' && !esMarcat && !foraDeRang && dataEvento;

      const classes = ['calendari-dia'];
      if (esMarcat) classes.push('calendari-dia--marcat');
      if (esInterval) classes.push('calendari-dia--interval');
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
          if (modeCalendari === 'esdeveniment') {
            // Es queda en mode "esdeveniment" perquè l'admin pugui ajustar
            // l'hora abans de passar al límit de compra (amb el botó "Següent").
            omplirCampData(inputFecha, any, mes, dia, '20:00');
            renderCalendariLimit();
          } else {
            omplirCampData(inputLimit, any, mes, dia, '23:59');
            renderCalendariLimit();
            amagarMiniCalendariLimit();
          }
        });
        cella.appendChild(btn);
      }

      limitGraella.appendChild(cella);
    }
  }

  document.getElementById('limit-mes-anterior').addEventListener('click', () => {
    calMesVisible.setMonth(calMesVisible.getMonth() - 1);
    renderCalendariLimit();
  });
  document.getElementById('limit-mes-seguent').addEventListener('click', () => {
    calMesVisible.setMonth(calMesVisible.getMonth() + 1);
    renderCalendariLimit();
  });

  document.getElementById('mini-calendari-seguent').addEventListener('click', () => {
    const dataEvento = valorInput(inputFecha);
    modeCalendari = 'limit';
    if (dataEvento) calMesVisible = new Date(dataEvento.getFullYear(), dataEvento.getMonth(), 1);
    renderCalendariLimit();
    inputLimit.focus();
  });

  function obrirCalendari(mode) {
    modeCalendari = mode;
    const referencia = mode === 'esdeveniment' ? valorInput(inputFecha) : valorInput(inputLimit) || valorInput(inputFecha);
    calMesVisible = referencia ? new Date(referencia.getFullYear(), referencia.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    renderCalendariLimit();
    miniCalendari.classList.remove('hidden');
  }

  function amagarMiniCalendariLimit() {
    miniCalendari.classList.add('hidden');
  }

  inputFecha.addEventListener('focus', () => obrirCalendari('esdeveniment'));
  inputFecha.addEventListener('click', () => obrirCalendari('esdeveniment'));
  inputLimit.addEventListener('focus', () => obrirCalendari('limit'));
  inputLimit.addEventListener('click', () => obrirCalendari('limit'));
  miniCalendari.addEventListener('click', (evt) => evt.stopPropagation());
  document.getElementById('btn-tancar-mini-calendari').addEventListener('click', amagarMiniCalendariLimit);
  document.addEventListener('click', (evt) => {
    if (!campAmbMinicalendari.contains(evt.target)) {
      amagarMiniCalendariLimit();
    }
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') amagarMiniCalendariLimit();
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

  document.getElementById('link-export-csv').href = `/api/admin/eventos/${eventoId}/compras/export.csv`;

  configurarTraduccioNom({
    ca: document.getElementById('nombre'),
    es: document.getElementById('nombre_es'),
    en: document.getElementById('nombre_en'),
  });
  configurarTraduccioNom({
    ca: document.getElementById('descripcion'),
    es: document.getElementById('descripcion_es'),
    en: document.getElementById('descripcion_en'),
  });

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

  let camposFormularioActuals = [];
  let indexCampEditant = null;
  let opcionsModalActuals = [];

  const gestorInvitatsEditar = crearGestorInvitados('llista-invitats');
  document.getElementById('btn-afegir-invitat').addEventListener('click', () => gestorInvitatsEditar.afegir());

  function generarIdCamp() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function etiquetaTipo(tipo) {
    return { texto: 'Text lliure', numero: 'Número', seleccion: 'Selecció' }[tipo] || tipo;
  }

  function renderLlistaCamps() {
    const cont = document.getElementById('llista-camps-formulari');
    cont.innerHTML = '';
    if (camposFormularioActuals.length === 0) {
      cont.innerHTML = '<p class="camps-formulari-buit">Encara no hi ha cap camp definit.</p>';
      return;
    }
    camposFormularioActuals.forEach((campo, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-camp-formulari';
      fila.innerHTML = `
        <span class="fila-camp-formulari-etiqueta">${escapeHtml(campo.etiqueta)}</span>
        <span class="fila-camp-formulari-tipus">${etiquetaTipo(campo.tipo)}</span>
        <button type="button" data-accio="requerido" data-i="${i}" aria-pressed="${campo.requerido ? 'true' : 'false'}" aria-label="${campo.requerido ? 'Camp obligatori (clica per fer-lo opcional)' : 'Camp opcional (clica per fer-lo obligatori)'}" title="Obligatori">*</button>
        <button type="button" data-accio="pujar" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Puja ${escapeHtml(campo.etiqueta)}">▲</button>
        <button type="button" data-accio="baixar" data-i="${i}" ${i === camposFormularioActuals.length - 1 ? 'disabled' : ''} aria-label="Baixa ${escapeHtml(campo.etiqueta)}">▼</button>
        <button type="button" data-accio="editar" data-i="${i}" aria-label="Edita ${escapeHtml(campo.etiqueta)}">✎</button>
        <button type="button" data-accio="eliminar" data-i="${i}" aria-label="Elimina ${escapeHtml(campo.etiqueta)}">✕</button>
      `;
      cont.appendChild(fila);
    });

    cont.querySelectorAll('button[data-accio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const accio = btn.dataset.accio;
        if (accio === 'requerido') {
          camposFormularioActuals[i].requerido = !camposFormularioActuals[i].requerido;
          renderLlistaCamps();
        } else if (accio === 'pujar' && i > 0) {
          [camposFormularioActuals[i - 1], camposFormularioActuals[i]] = [camposFormularioActuals[i], camposFormularioActuals[i - 1]];
          renderLlistaCamps();
        } else if (accio === 'baixar' && i < camposFormularioActuals.length - 1) {
          [camposFormularioActuals[i + 1], camposFormularioActuals[i]] = [camposFormularioActuals[i], camposFormularioActuals[i + 1]];
          renderLlistaCamps();
        } else if (accio === 'eliminar') {
          camposFormularioActuals.splice(i, 1);
          renderLlistaCamps();
        } else if (accio === 'editar') {
          obrirModalCamp(i);
        }
      });
    });
  }

  function renderOpcionsModal(opciones) {
    const cont = document.getElementById('llista-opcions-camp');
    cont.innerHTML = '';
    opciones.forEach((opcio, i) => {
      const fila = document.createElement('div');
      fila.className = 'fila-opcio-camp';
      fila.innerHTML = `<input type="text" value="${escapeAttr(opcio)}" data-i="${i}"><button type="button" data-i="${i}">✕</button>`;
      cont.appendChild(fila);
    });
    cont.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        opcionsModalActuals.splice(parseInt(btn.dataset.i, 10), 1);
        renderOpcionsModal(opcionsModalActuals);
      });
    });
    cont.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        opcionsModalActuals[parseInt(input.dataset.i, 10)] = input.value;
      });
    });
  }

  function obrirModalCamp(i) {
    indexCampEditant = i === undefined ? null : i;
    const campo = i === undefined ? null : camposFormularioActuals[i];
    document.getElementById('camp-etiqueta').value = campo ? campo.etiqueta : '';
    document.getElementById('camp-tipo').value = campo ? campo.tipo : 'texto';
    document.getElementById('camp-unidad').value = campo && campo.unidad ? campo.unidad : '';
    document.getElementById('camp-min').value = campo && campo.min !== undefined ? campo.min : '';
    document.getElementById('camp-max').value = campo && campo.max !== undefined ? campo.max : '';
    document.getElementById('camp-requerido').checked = !!(campo && campo.requerido);
    document.getElementById('camp-multiple').checked = !!(campo && campo.multiple);
    opcionsModalActuals = campo && Array.isArray(campo.opciones) ? [...campo.opciones] : [];
    renderOpcionsModal(opcionsModalActuals);
    document.getElementById('error-camp-formulari').textContent = '';
    actualitzarVisibilitatTipusModal();
    document.getElementById('modal-camp-formulari').classList.remove('hidden');
  }

  function actualitzarVisibilitatTipusModal() {
    const tipo = document.getElementById('camp-tipo').value;
    document.getElementById('camp-opcions-numero').classList.toggle('hidden', tipo !== 'numero');
    document.getElementById('camp-opcions-seleccion').classList.toggle('hidden', tipo !== 'seleccion');
  }

  document.getElementById('camp-tipo').addEventListener('change', actualitzarVisibilitatTipusModal);
  document.getElementById('btn-afegir-camp').addEventListener('click', () => obrirModalCamp(undefined));
  document.getElementById('btn-cancelar-camp').addEventListener('click', () => {
    document.getElementById('modal-camp-formulari').classList.add('hidden');
  });
  document.getElementById('btn-afegir-opcio-camp').addEventListener('click', () => {
    opcionsModalActuals.push('');
    renderOpcionsModal(opcionsModalActuals);
  });

  document.getElementById('btn-desar-camp').addEventListener('click', () => {
    const errorEl = document.getElementById('error-camp-formulari');
    const etiqueta = document.getElementById('camp-etiqueta').value.trim();
    const tipo = document.getElementById('camp-tipo').value;
    if (!etiqueta) {
      errorEl.textContent = 'Cal una etiqueta per al camp.';
      return;
    }
    if (tipo === 'seleccion' && opcionsModalActuals.filter((o) => o.trim()).length === 0) {
      errorEl.textContent = 'Cal almenys una opció.';
      return;
    }
    const campo = {
      id: indexCampEditant !== null ? camposFormularioActuals[indexCampEditant].id : generarIdCamp(),
      etiqueta,
      tipo,
      requerido: document.getElementById('camp-requerido').checked,
    };
    if (tipo === 'numero') {
      const unidad = document.getElementById('camp-unidad').value.trim();
      const min = document.getElementById('camp-min').value;
      const max = document.getElementById('camp-max').value;
      if (unidad) campo.unidad = unidad;
      if (min !== '') campo.min = parseFloat(min);
      if (max !== '') campo.max = parseFloat(max);
    }
    if (tipo === 'seleccion') {
      campo.opciones = opcionsModalActuals.map((o) => o.trim()).filter(Boolean);
      campo.multiple = document.getElementById('camp-multiple').checked;
    }

    if (indexCampEditant !== null) {
      camposFormularioActuals[indexCampEditant] = campo;
    } else {
      camposFormularioActuals.push(campo);
    }
    document.getElementById('modal-camp-formulari').classList.add('hidden');
    renderLlistaCamps();
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
    document.getElementById('nombre_es').value = evento.nombre_es || '';
    document.getElementById('nombre_en').value = evento.nombre_en || '';
    document.getElementById('fecha').value = aInputDatetimeLocal(evento.fecha);
    document.getElementById('descripcion').value = evento.descripcion || '';
    document.getElementById('descripcion_es').value = evento.descripcion_es || '';
    document.getElementById('descripcion_en').value = evento.descripcion_en || '';
    document.getElementById('precio').value = (evento.precio / 100).toFixed(2);
    document.getElementById('aforo_total').value = evento.aforo_total;
    document.getElementById('fecha_limite_compra').value = aInputDatetimeLocal(evento.fecha_limite_compra);
    document.getElementById('estado').value = evento.estado;
    gestorInvitatsEditar.carregar(evento.invitados);
    document.getElementById('email_asunto').value = evento.email_asunto || '';
    document.getElementById('email_html').value = evento.email_html || '';
    camposFormularioActuals = Array.isArray(evento.campos_formulario) ? evento.campos_formulario : [];
    renderLlistaCamps();
  }

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
      nombre_es: document.getElementById('nombre_es').value,
      nombre_en: document.getElementById('nombre_en').value,
      fecha: new Date(document.getElementById('fecha').value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      descripcion_es: document.getElementById('descripcion_es').value,
      descripcion_en: document.getElementById('descripcion_en').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: new Date(document.getElementById('fecha_limite_compra').value).toISOString(),
      estado: document.getElementById('estado').value,
      invitados,
      campos_formulario: camposFormularioActuals,
      email_asunto: document.getElementById('email_asunto').value,
      email_html: document.getElementById('email_html').value,
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

  function actualitzarCapsaleraCompras() {
    if (!filaCapsaleraCompras) return;
    filaCapsaleraCompras.querySelectorAll('th[data-camp-dinamic]').forEach((th) => th.remove());
    const thAccions = filaCapsaleraCompras.querySelector('th:last-child');
    camposFormularioActuals.forEach((campo) => {
      const th = document.createElement('th');
      th.dataset.campDinamic = '1';
      th.textContent = campo.etiqueta;
      filaCapsaleraCompras.insertBefore(th, thAccions);
    });
  }

  async function carregarCompras() {
    const res = await apiFetch(`/api/admin/eventos/${eventoId}/compras`);
    if (!res) return;
    const compras = await res.json();
    actualitzarCapsaleraCompras();
    taulaCompras.innerHTML = '';
    compras.forEach((c) => {
      const potCancelar = ['pendiente', 'pagado'].includes(c.estado_pago) && rolActual !== 'viewer';
      const respuestas = c.respuestas_campos || {};
      const tdsCamps = camposFormularioActuals.map((campo) => {
        const valor = respuestas[campo.id];
        const text = Array.isArray(valor) ? valor.join(', ') : (valor ?? '');
        return `<td>${escapeHtml(text)}</td>`;
      }).join('');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.nombre_comprador)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.telefono || '—')}</td>
        <td>${c.cantidad}</td>
        <td>${formatEuros(c.importe_total)}</td>
        <td>${c.quiere_factura ? 'Sí' : 'No'}</td>
        <td>${escapeHtml(c.nif || '—')}</td>
        <td>${escapeHtml(c.nombre_fiscal || '—')}</td>
        <td>${escapeHtml(c.direccion_fiscal || '—')}</td>
        <td>${formatData(c.created_at)}</td>
        ${tdsCamps}
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

  // Espera a conèixer el rol abans de pintar les compres, perquè el botó
  // "Cancel·lar" no aparegui un instant per després desaparèixer.
  aplicarRestriccionsPerRol().then(async () => {
    await carregarEvento();
    carregarCompras();
  });
}
