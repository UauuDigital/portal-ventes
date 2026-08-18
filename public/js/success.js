function localeActual() {
  return window.i18n ? window.i18n.localeActual() : 'ca-ES';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text === null || text === undefined ? '' : String(text);
  return div.innerHTML;
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
    const data = await res.json();
    const dataText = new Date(data.evento.fecha).toLocaleString(localeActual());
    const importText = (data.compra.importe_total / 100).toFixed(2) + ' €';

    contenidor.innerHTML = `
      <p class="subtitle">
        <strong>${escapeHtml(data.evento.nombre)}</strong><br>
        📅 ${escapeHtml(dataText)}<br>
        🎟️ ${data.compra.cantidad} entrada(es) — ${escapeHtml(importText)}
      </p>
    `;
  } catch (err) {
    contenidor.innerHTML = '<p class="subtitle">No hem pogut recuperar els detalls de la teva compra. Si el pagament s\'ha completat, rebràs igualment la confirmació per email.</p>';
  }
}

document.addEventListener('DOMContentLoaded', carregarConfirmacio);
