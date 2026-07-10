async function carregarEvento() {
  const res = await fetch('/api/evento/actual');
  const data = await res.json();

  const form = document.getElementById('form-compra');
  const avis = document.getElementById('estat-no-disponible');

  if (!data.disponible) {
    form.classList.add('hidden');
    avis.classList.remove('hidden');
    const motius = {
      no_hi_ha_event_actiu: "Ara mateix no hi ha cap esdeveniment obert per a la venda d'entrades.",
      data_limit_superada: 'El termini de compra per a aquest esdeveniment ha finalitzat.',
      aforament_exhaurit: "Les entrades per a aquest esdeveniment s'han esgotat.",
    };
    avis.textContent = motius[data.motiu] || 'La compra no està disponible ara mateix.';
    if (data.evento) {
      document.getElementById('evento-nombre').textContent = data.evento.nombre;
      document.getElementById('evento-descripcio').textContent = data.evento.descripcion || '';
    }
    return null;
  }

  const ev = data.evento;
  document.getElementById('evento-nombre').textContent = ev.nombre;
  document.getElementById('evento-descripcio').textContent = ev.descripcion || '';
  document.getElementById('evento-data').textContent = '📅 ' + new Date(ev.fecha).toLocaleString('ca-ES');
  document.getElementById('evento-preu').textContent = '💶 ' + (ev.precio / 100).toFixed(2) + ' € / entrada';
  document.getElementById('evento-aforo').textContent = '🎟️ ' + ev.aforo_disponible + ' places disponibles';

  return ev;
}

function toggleCampsFiscals() {
  const checked = document.getElementById('quiere_factura').checked;
  const camps = document.getElementById('camps-fiscals');
  camps.classList.toggle('hidden', !checked);
  ['nif', 'nombre_fiscal', 'direccion_fiscal'].forEach((id) => {
    document.getElementById(id).required = checked;
  });
}

async function enviarFormulari(evt) {
  evt.preventDefault();
  const btn = document.getElementById('btn-comprar');
  const errorEl = document.getElementById('error-missatge');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Processant…';

  const body = {
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
  carregarEvento();
  document.getElementById('quiere_factura').addEventListener('change', toggleCampsFiscals);
  document.getElementById('form-compra').addEventListener('submit', enviarFormulari);
});
