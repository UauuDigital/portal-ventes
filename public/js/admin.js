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

    const fechaEventoInput = document.getElementById('fecha');
    const fechaLimiteInput = document.getElementById('fecha_limite_compra');
    const fechaLimite = new Date(fechaLimiteInput.dataset.valor || fechaLimiteInput.value);
    if (fechaLimite < new Date()) {
      errorEl.textContent = 'La data límit de compra no pot ser una data ja passada.';
      return;
    }

    const body = {
      nombre: document.getElementById('nombre').value,
      fecha: new Date(fechaEventoInput.dataset.valor || fechaEventoInput.value).toISOString(),
      descripcion: document.getElementById('descripcion').value,
      precio: Math.round(parseFloat(document.getElementById('precio').value) * 100),
      aforo_total: parseInt(document.getElementById('aforo_total').value, 10),
      fecha_limite_compra: fechaLimite.toISOString(),
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
      carregarEventos();
      renderCalendariLimit();
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
