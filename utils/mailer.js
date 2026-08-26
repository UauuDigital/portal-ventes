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

const ASSUMPTE_DEFECTE = 'Confirmació de la teva entrada — {{nom_esdeveniment}}';

const HTML_DEFECTE = `
    <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
      <h1 style="font-size:20px;">Reserva confirmada</h1>
      <p>Hola {{nom_comprador}},</p>
      <p>La teva compra per a <strong>{{nom_esdeveniment}}</strong> ha quedat confirmada.</p>
      <ul>
        <li><strong>Data i hora:</strong> {{data_hora}}</li>
        <li><strong>Entrades:</strong> {{quantitat}}</li>
        <li><strong>Import total:</strong> {{import_total}}</li>
      </ul>
      {{enllac_edicio}}
      <p>Ens veiem a l'esdeveniment!</p>
    </div>
  `;

/** Variables disponibles a l'assumpte i al cos de l'email (vegeu admin/evento.html). */
const VARIABLES_DISPONIBLES = [
  'nom_comprador', 'nom_esdeveniment', 'data_hora', 'quantitat',
  'import_total', 'dades_factura', 'enllac_edicio',
];

function substituirVariables(text, variables) {
  return VARIABLES_DISPONIBLES.reduce(
    (acc, clau) => acc.split(`{{${clau}}}`).join(variables[clau] || ''),
    text
  );
}

/**
 * Calcula els valors de les variables a partir d'una compra i un
 * esdeveniment. Compartit entre l'enviament real (dades de compra
 * autèntiques) i l'enviament de prova (dades d'exemple), perquè els dos
 * facin servir exactament la mateixa lògica de renderitzat.
 */
function calcularVariables({ compra, evento, baseUrl }) {
  const enllacEdicio = compra.edit_token && new Date() < new Date(evento.fecha)
    ? `<p>Pots revisar o modificar les teves dades (com les al·lèrgies) fins al dia de l'esdeveniment des d'aquest enllaç: <br>
       <a href="${baseUrl}/mis-datos.html?token=${compra.edit_token}">${baseUrl}/mis-datos.html?token=${compra.edit_token}</a></p>`
    : '';

  return {
    nom_comprador: compra.nombre_comprador,
    nom_esdeveniment: evento.nombre,
    data_hora: formatDataHora(evento.fecha),
    quantitat: String(compra.cantidad),
    import_total: formatEuros(compra.importe_total),
    // dades_factura ja no es calcula (facturació eliminada del checkout),
    // però es manté a VARIABLES_DISPONIBLES/substituirVariables perquè un
    // esdeveniment amb email_html personalitzat que encara contingui
    // {{dades_factura}} el substitueixi per buit en lloc de deixar-hi el
    // placeholder literal.
    dades_factura: '',
    enllac_edicio: enllacEdicio,
  };
}

/**
 * Renderitza l'assumpte i el cos de l'email de confirmació. Fa servir la
 * plantilla de l'esdeveniment (`evento.email_asunto`/`email_html`) si
 * n'hi ha, i la per defecte en cas contrari.
 */
function renderitzarEmail({ compra, evento, baseUrl }) {
  const variables = calcularVariables({ compra, evento, baseUrl });
  const assumpte = evento.email_asunto && evento.email_asunto.trim() ? evento.email_asunto : ASSUMPTE_DEFECTE;
  const html = evento.email_html && evento.email_html.trim() ? evento.email_html : HTML_DEFECTE;
  return {
    subject: substituirVariables(assumpte, variables),
    html: substituirVariables(html, variables),
  };
}

/**
 * Enviament "best effort": si falla (clau no configurada, error de xarxa,
 * domini no verificat...) es loggeja i no es propaga, perquè no ha de fer
 * fallar la confirmació del webhook de Stripe.
 */
async function enviarEmailConfirmacio({ compra, evento, baseUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('No s\'ha pogut enviar l\'email de confirmació: falta RESEND_API_KEY.');
    return;
  }

  const { subject, html } = renderitzarEmail({ compra, evento, baseUrl });

  try {
    await client().emails.send({
      from: process.env.RESEND_FROM,
      to: compra.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('Error enviant l\'email de confirmació via Resend:', err);
  }
}

/**
 * Enviament de prova des de l'admin: fa servir dades d'exemple (no una
 * compra real) i, a diferència de enviarEmailConfirmacio, propaga
 * qualsevol error perquè l'admin en tingui feedback immediat.
 */
async function enviarEmailPrueba({ destinatario, asunto, html, evento, baseUrl }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Falta RESEND_API_KEY a la configuració del servidor.');
  }

  const compraExemple = {
    nombre_comprador: 'Nom Exemple',
    cantidad: 2,
    importe_total: evento.precio ? evento.precio * 2 : 4000,
    edit_token: 'token-de-prova-no-funcional',
  };

  const { subject } = renderitzarEmail({
    compra: compraExemple,
    evento: { ...evento, email_asunto: asunto },
    baseUrl,
  });
  const variables = calcularVariables({ compra: compraExemple, evento, baseUrl });
  const htmlRenderitzat = substituirVariables(html && html.trim() ? html : HTML_DEFECTE, variables);

  await client().emails.send({
    from: process.env.RESEND_FROM,
    to: destinatario,
    subject: `[PROVA] ${subject}`,
    html: htmlRenderitzat,
  });
}

module.exports = { enviarEmailConfirmacio, enviarEmailPrueba, VARIABLES_DISPONIBLES };
