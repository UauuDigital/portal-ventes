function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// Igual que escapeHtml, però també escapa les cometes: cal fer-la servir
// quan el valor s'insereix dins un atribut HTML delimitat per cometes
// dobles (p. ex. value="${escapeAttr(valor)}"), perquè escapeHtml sol no
// escapa el caràcter " i una cometa dins el valor trencaria l'atribut.
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function token() {
  return new URLSearchParams(window.location.search).get('token');
}

let campsActuals = [];

function renderCamps(campos, respuestas) {
  const cont = document.getElementById('camps-formulari-misdatos');
  cont.innerHTML = '';
  campos.forEach((campo) => {
    const valor = respuestas[campo.id];
    const wrap = document.createElement('div');
    wrap.className = 'camp-dinamic';

    if (campo.tipo === 'texto') {
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</label>
        <input type="text" id="camp_${campo.id}" value="${escapeAttr(valor || '')}" ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'numero') {
      const min = campo.min !== undefined ? `min="${campo.min}"` : '';
      const max = campo.max !== undefined ? `max="${campo.max}"` : '';
      const unitat = campo.unidad ? ` (${escapeHtml(campo.unidad)})` : '';
      wrap.innerHTML = `
        <label for="camp_${campo.id}">${escapeHtml(campo.etiqueta)}${unitat}${campo.requerido ? ' *' : ''}</label>
        <input type="number" id="camp_${campo.id}" value="${valor !== undefined ? valor : ''}" ${min} ${max} ${campo.requerido ? 'required' : ''}>
      `;
    } else if (campo.tipo === 'seleccion') {
      const seleccionats = campo.multiple ? (valor || []) : [valor];
      const inputType = campo.multiple ? 'checkbox' : 'radio';
      const opcions = (campo.opciones || []).map((op) => `
        <label class="opcio-dinamica">
          <input type="${inputType}" name="camp_${campo.id}" value="${escapeAttr(op)}" ${seleccionats.includes(op) ? 'checked' : ''}>
          ${escapeHtml(op)}
        </label>
      `).join('');
      wrap.innerHTML = `<span class="camp-dinamic-etiqueta">${escapeHtml(campo.etiqueta)}${campo.requerido ? ' *' : ''}</span>${opcions}`;
    }

    cont.appendChild(wrap);
  });
  campsActuals = campos;
}

function llegirRespostes() {
  const respostes = {};
  campsActuals.forEach((campo) => {
    if (campo.tipo === 'texto') {
      respostes[campo.id] = document.getElementById(`camp_${campo.id}`).value;
    } else if (campo.tipo === 'numero') {
      const v = document.getElementById(`camp_${campo.id}`).value;
      if (v !== '') respostes[campo.id] = parseFloat(v);
    } else if (campo.tipo === 'seleccion') {
      const marcats = Array.from(document.querySelectorAll(`input[name="camp_${campo.id}"]:checked`)).map((i) => i.value);
      respostes[campo.id] = campo.multiple ? marcats : (marcats[0] || '');
    }
  });
  return respostes;
}

async function iniciar() {
  const t = token();
  const avis = document.getElementById('estat-misdatos');
  if (!t) {
    avis.textContent = 'Aquest enllaç no és vàlid.';
    avis.classList.remove('hidden');
    return;
  }

  const res = await fetch(`/api/mis-datos/${t}`);
  if (!res.ok) {
    avis.textContent = 'Aquest enllaç no és vàlid.';
    avis.classList.remove('hidden');
    return;
  }
  const data = await res.json();

  document.getElementById('evento-nombre-misdatos').textContent = data.evento.nombre;
  document.getElementById('evento-data-misdatos').textContent = new Date(data.evento.fecha).toLocaleString('ca-ES');

  if (!data.editable) {
    avis.textContent = 'Ja no es poden modificar les dades, l\'esdeveniment ja ha tingut lloc.';
    avis.classList.remove('hidden');
    return;
  }

  renderCamps(data.campos_formulario, data.respuestas_campos || {});
  document.getElementById('form-misdatos').classList.remove('hidden');

  document.getElementById('form-misdatos').addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('error-misdatos');
    const okEl = document.getElementById('ok-misdatos');
    errorEl.textContent = '';
    okEl.classList.add('hidden');

    const resPut = await fetch(`/api/mis-datos/${t}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas_campos: llegirRespostes() }),
    });
    const dataPut = await resPut.json();
    if (resPut.ok) {
      okEl.classList.remove('hidden');
    } else {
      errorEl.textContent = (dataPut.detalls || ['No s\'han pogut desar els canvis.']).join(', ');
    }
  });
}

iniciar();
