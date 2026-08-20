function localeActual() {
  return window.i18n ? window.i18n.localeActual() : 'ca-ES';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
}

let dadesConfirmacio = null;

function renderitzarConfirmacio() {
  const contenidor = document.getElementById('detall-confirmacio');
  if (!contenidor || !dadesConfirmacio) return;

  const data = dadesConfirmacio;
  const dataText = new Date(data.evento.fecha).toLocaleString(localeActual());
  const importText = (data.compra.importe_total / 100).toFixed(2) + ' €';

  const avisFactura = data.compra.quiere_factura
    ? `<p class="subtitle">${escapeHtml(window.i18n ? window.i18n.t('avis_dos_correus') : 'Com que has demanat factura, rebràs dos correus: la confirmació de la teva entrada i, més endavant, la factura.')}</p>`
    : '';

  contenidor.innerHTML = `
    <p class="subtitle">
      <strong>${escapeHtml(data.evento.nombre)}</strong><br>
      📅 ${escapeHtml(dataText)}<br>
      🎟️ ${data.compra.cantidad} entrada(es) — ${escapeHtml(importText)}
    </p>
    ${avisFactura}
  `;
}

async function carregarConfirmacio() {
  const contenidor = document.getElementById('detall-confirmacio');
  if (!contenidor) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  if (!sessionId) return;

  try {
    const res = await fetch(`/api/checkout/confirmacion/${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      contenidor.innerHTML = '<p class="subtitle">No hem pogut recuperar els detalls de la teva compra. Si el pagament s\'ha completat, rebràs igualment la confirmació per email.</p>';
      return;
    }
    dadesConfirmacio = await res.json();
    renderitzarConfirmacio();
  } catch (err) {
    contenidor.innerHTML = '<p class="subtitle">No hem pogut recuperar els detalls de la teva compra. Si el pagament s\'ha completat, rebràs igualment la confirmació per email.</p>';
  }
}

document.addEventListener('DOMContentLoaded', carregarConfirmacio);
document.addEventListener('idiomaCanviat', renderitzarConfirmacio);
