const { Resend } = require('resend');

let resend = null;
function client() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function formatEuros(centims) {
  return (centims / 100).toFixed(2) + ' €';
}

function formatDataHora(isoString) {
  const data = new Date(isoString);
  const dataText = data.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const horaText = data.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  return `${dataText} a les ${horaText}h`;
}

/**
 * Enviament "best effort": si falla (clau no configurada, error de xarxa,
 * domini no verificat...) es loggeja i no es propaga, perquè no ha de fer
 * fallar la confirmació del webhook de Stripe.
 */
async function enviarEmailConfirmacio({ compra, evento }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('No s\'ha pogut enviar l\'email de confirmació: falta RESEND_API_KEY.');
    return;
  }

  const dadesFactura = compra.quiere_factura
    ? `<p><strong>Dades de facturació</strong><br>
       ${compra.nombre_fiscal}<br>
       NIF/CIF: ${compra.nif}<br>
       ${compra.direccion_fiscal}</p>`
    : '';

  const html = `
    <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
      <h1 style="font-size:20px;">Reserva confirmada</h1>
      <p>Hola ${compra.nombre_comprador},</p>
      <p>La teva compra per a <strong>${evento.nombre}</strong> ha quedat confirmada.</p>
      <ul>
        <li><strong>Data i hora:</strong> ${formatDataHora(evento.fecha)}</li>
        <li><strong>Entrades:</strong> ${compra.cantidad}</li>
        <li><strong>Import total:</strong> ${formatEuros(compra.importe_total)}</li>
      </ul>
      ${dadesFactura}
      <p>Ens veiem a l'esdeveniment!</p>
    </div>
  `;

  try {
    await client().emails.send({
      from: process.env.RESEND_FROM,
      to: compra.email,
      subject: `Confirmació de la teva entrada — ${evento.nombre}`,
      html,
    });
  } catch (err) {
    console.error('Error enviant l\'email de confirmació via Resend:', err);
  }
}

module.exports = { enviarEmailConfirmacio };
