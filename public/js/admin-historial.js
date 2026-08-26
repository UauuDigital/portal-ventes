// Bloc "Historial" de la pantalla principal de l'admin: mostra els últims
// moviments (creacions, modificacions manuals i automàtiques, compres,
// pagaments i cancel·lacions) llegits de GET /api/admin/historial.
// Depèn de apiFetch/escapeHtml, definides a admin.js (carregat abans).

const llistaHistorial = document.getElementById('historial-llista');
if (llistaHistorial) {
  const MIDA_PAGINA = 20;
  let offsetHistorial = 0;
  let totsCarregats = false;
  const btnCarregarMes = document.getElementById('btn-historial-mes');

  const ETIQUETES_ACCIO = {
    creacio: 'Creació',
    compra: 'Compra',
    modificacio: 'Modificació',
    cancelacio: 'Cancel·lació',
    pagament: 'Pagament',
    eliminacio: 'Eliminació',
  };

  const ETIQUETES_ORIGEN = {
    manual: 'admin',
    automatic: 'sistema',
    client: 'comprador',
  };

  function classeAccio(accio) {
    if (accio === 'cancelacio' || accio === 'eliminacio') return 'vermell';
    if (accio === 'pagament' || accio === 'creacio' || accio === 'compra') return 'verd';
    return 'gris';
  }

  function formatDataHistorial(isoString) {
    const data = new Date(isoString);
    const dataText = data.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const horaText = data.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    return `${dataText} · ${horaText}`;
  }

  // Etiquetes llegibles per als noms de camp guardats a dades_abans/dades_despres
  // (coincideixen amb les columnes de eventos/compras a config/schema.sql).
  const ETIQUETES_CAMP = {
    nombre: 'Nom',
    fecha: 'Data', descripcion: 'Descripció',
    precio: 'Preu', aforo_total: 'Aforament total', fecha_limite_compra: 'Data límit de compra',
    estado: 'Estat', nombre_invitado: 'Nom del convidat', cargo_invitado: 'Càrrec del convidat',
    campos_formulario: 'Camps del formulari', email_asunto: 'Assumpte de l\'email', email_html: 'HTML de l\'email',
    estado_pago: 'Estat del pagament', total: 'Total',
  };

  function etiquetaCamp(camp) {
    return ETIQUETES_CAMP[camp] || camp;
  }

  function formatValorCamp(camp, valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'object') return JSON.stringify(valor);
    if (camp === 'precio') return formatEuros(valor);
    if (camp === 'fecha' || camp === 'fecha_limite_compra') return formatData(valor);
    if (camp === 'estado') return valor === 'abierto' ? 'Obert' : 'Tancat';
    if (camp === 'estado_pago') return valor;
    return String(valor);
  }

  function obrirModalHistorial(entrada) {
    document.getElementById('historial-detall-descripcio').textContent = entrada.descripcio;

    const origenText = ETIQUETES_ORIGEN[entrada.origen] || entrada.origen;
    const usuariText = entrada.usuari ? ` (${entrada.usuari})` : '';
    const eventoText = entrada.evento_nombre ? ` · ${entrada.evento_nombre}` : '';
    document.getElementById('historial-detall-meta').textContent =
      `${formatDataHistorial(entrada.created_at)} · ${origenText}${usuariText}${eventoText}`;

    const contCanvis = document.getElementById('historial-detall-canvis');
    contCanvis.innerHTML = '';

    const abans = entrada.dades_abans || {};
    const despres = entrada.dades_despres || {};
    const camps = Array.from(new Set([...Object.keys(abans), ...Object.keys(despres)]));

    if (camps.length === 0) {
      contCanvis.innerHTML = '<p class="admin-historial-detall-buit">No hi ha detall de camps per a aquest moviment.</p>';
    } else {
      camps.forEach((camp) => {
        const fila = document.createElement('div');
        fila.className = 'fila-canvi-historial';
        const teAbans = Object.prototype.hasOwnProperty.call(abans, camp);
        const teDespres = Object.prototype.hasOwnProperty.call(despres, camp);
        fila.innerHTML = `
          <span class="fila-canvi-historial-etiqueta">${escapeHtml(etiquetaCamp(camp))}</span>
          <div class="fila-canvi-historial-valors">
            ${teAbans ? `<span class="valor-anterior">${escapeHtml(formatValorCamp(camp, abans[camp]))}</span>` : ''}
            ${teAbans && teDespres ? '<span class="fletxa-canvi">→</span>' : ''}
            ${teDespres ? `<span class="valor-nou">${escapeHtml(formatValorCamp(camp, despres[camp]))}</span>` : ''}
          </div>
        `;
        contCanvis.appendChild(fila);
      });
    }

    document.getElementById('modal-historial-detall').classList.remove('hidden');
  }

  const modalHistorial = document.getElementById('modal-historial-detall');
  const btnTancarHistorial = document.getElementById('btn-tancar-historial');
  if (modalHistorial && btnTancarHistorial) {
    function tancarModalHistorial() {
      modalHistorial.classList.add('hidden');
    }
    btnTancarHistorial.addEventListener('click', tancarModalHistorial);
    modalHistorial.addEventListener('click', (evt) => {
      if (evt.target === modalHistorial) tancarModalHistorial();
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !modalHistorial.classList.contains('hidden')) tancarModalHistorial();
    });
  }

  function renderEntradesHistorial(entrades, afegir) {
    if (!afegir) llistaHistorial.innerHTML = '';
    if (entrades.length === 0 && !afegir) {
      llistaHistorial.innerHTML = '<p class="admin-historial-buit">Encara no hi ha cap moviment registrat.</p>';
      return;
    }
    entrades.forEach((entrada) => {
      const div = document.createElement('div');
      div.className = `admin-historial-entrada admin-historial-entrada--${classeAccio(entrada.accio)}`;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      const origenText = ETIQUETES_ORIGEN[entrada.origen] || entrada.origen;
      const usuariText = entrada.usuari ? ` (${escapeHtml(entrada.usuari)})` : '';
      const eventoText = entrada.evento_nombre ? ` · ${escapeHtml(entrada.evento_nombre)}` : '';
      div.innerHTML = `
        <span class="admin-historial-badge">${ETIQUETES_ACCIO[entrada.accio] || entrada.accio}</span>
        <div class="admin-historial-cos">
          <p class="admin-historial-descripcio">${escapeHtml(entrada.descripcio)}</p>
          <p class="admin-historial-meta">${formatDataHistorial(entrada.created_at)} · ${escapeHtml(origenText)}${usuariText}${eventoText}</p>
        </div>
      `;
      div.addEventListener('click', () => obrirModalHistorial(entrada));
      div.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          obrirModalHistorial(entrada);
        }
      });
      llistaHistorial.appendChild(div);
    });
  }

  async function carregarHistorial(afegir) {
    const res = await apiFetch(`/api/admin/historial?limit=${MIDA_PAGINA}&offset=${offsetHistorial}`);
    if (!res || !res.ok) return;
    const entrades = await res.json();
    renderEntradesHistorial(entrades, !!afegir);
    offsetHistorial += entrades.length;
    totsCarregats = entrades.length < MIDA_PAGINA;
    if (btnCarregarMes) btnCarregarMes.classList.toggle('hidden', totsCarregats);
  }

  if (btnCarregarMes) {
    btnCarregarMes.addEventListener('click', () => carregarHistorial(true));
  }

  carregarHistorial(false);
}
