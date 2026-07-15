// Funcions auxiliars i logica del panell d'administracio.

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

// Llistat i creacio d'esdeveniments
const taulaEventos = document.getElementById('taula-eventos');
if (taulaEventos) {
  async function carregarEventos() {
    const res = await apiFetch('/api/admin/eventos');
    if (!res) return;
    const eventos = await res.json();
    eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    taulaEventos.innerHTML = '';
    eventos.forEach((ev) => {
      const tr = document.createElement('tr');
      tr.className = 'admin-table-row-link';
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
