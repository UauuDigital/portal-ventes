/* Sistema de traducció compartit per a totes les pàgines públiques.
   Injecta un menú fix (sempre visible) per canviar d'idioma i tradueix
   qualsevol element amb l'atribut data-i18n="clau". L'idioma triat es
   guarda a localStorage i es manté entre pàgines i recàrregues. */
(function () {
  const IDIOMES = ['ca', 'es', 'en'];
  const ETIQUETES = { ca: 'CA', es: 'ES', en: 'EN' };
  const LOCALES = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
  const CLAU_STORAGE = 'idiomaSeleccionat';

  const TRADUCCIONS = {
    ca: {
      titol_index: 'Espai Econòmic — Reserva la teva entrada',
      selector_titol: "Tria l'esdeveniment",
      selector_subtitol: 'Ara mateix hi ha diverses reserves obertes. Tria a quina vols apuntar-te.',
      breadcrumb_tornar: '‹ Tots els esdeveniments',
      eyebrow_mes: 'Esdeveniment del mes',
      evento_carregant: "Carregant l'esdeveniment…",
      form_titol: 'Reserva la teva plaça',
      form_subtitol: 'Paga de forma segura amb targeta.',
      label_cantidad: "Nombre d'entrades",
      label_nom: 'Nom i cognoms',
      label_email: 'Email',
      label_telefon: 'Telèfon',
      checkbox_factura: 'Vull factura amb dades fiscals',
      label_nif: 'NIF / CIF',
      label_nom_fiscal: 'Nom fiscal',
      label_direccio_fiscal: 'Adreça fiscal',
      accepta_pre: 'Accepto les ',
      accepta_condicions: 'condicions de venda',
      accepta_i: ' i la ',
      accepta_privacitat: 'política de privacitat',
      btn_comprar: 'Pagar i reservar entrada',
      btn_comprar_processant: 'Processant…',
      pagament_divider: 'mètodes de pagament acceptats',
      footer_avis: 'Avís legal',
      footer_privacitat: 'Privacitat',
      footer_cookies: 'Cookies',
      footer_condicions: 'Condicions de venda',
      modal_tanca: 'Tanca',
      modal_carregant: 'Carregant…',
      modal_error: "No s'ha pogut carregar el contingut.",

      motiu_no_event: 'Ara mateix no hi ha cap esdeveniment obert per a la venda de entrades.',
      motiu_data_limit: 'El termini de compra per a aquest esdeveniment ha finalitzat.',
      motiu_aforament: "Les entrades per a aquest esdeveniment s'han esgotat.",
      motiu_default: 'La compra no està disponible ara mateix.',
      sense_places: 'Sense places disponibles',
      evento_default_desc: 'Torna aviat per veure el proper esdeveniment.',
      suffix_entrada: ' / entrada',
      places_disponibles: 'places disponibles',
      error_connexio: "No s'ha pogut connectar amb el servidor. Torna-ho a provar.",
      error_inesperat: 'Error inesperat.',

      titol_success: 'Compra confirmada — Espai Econòmic',
      eyebrow_pagament_rebut: 'Pagament rebut',
      gracies_compra: 'Gràcies per la teva compra!',
      rebras_confirmacio: 'Rebràs la confirmació de la teva entrada per email en breu.',
      reserva_confirmada: 'Reserva confirmada',
      pots_tancar: "Ja pots tancar aquesta finestra. Ens veiem a l'esdeveniment!",
      tornar_inici: "Tornar a l'inici",

      titol_cancel: 'Pagament cancel·lat — Espai Econòmic',
      eyebrow_no_complet: 'Pagament no completat',
      pagament_cancelat: "El pagament s'ha cancel·lat",
      sense_carrec: 'No s\'ha realitzat cap càrrec. La teva plaça no ha quedat reservada.',
      torna_provar: 'Torna-ho a provar',
      pots_tornar: 'Pots tornar a l\'inici i completar la compra quan vulguis, sempre que quedin places.',

      titol_avis_legal: 'Avís legal — Espai Econòmic',
      h1_avis_legal: 'Avís legal',
      cos_pendent_titol: 'Contingut pendent.',
      cos_avis_legal: "La redacció final d'aquest text (identificació del titular segons la LSSICE: raó social, NIF, domicili, dades de contacte i inscripció registral si aplica) està pendent de validació amb l'assessoria legal. Aquesta pàgina és un placeholder perquè no quedi cap enllaç legal trencat.",

      titol_condicions: 'Condicions de venda — Espai Econòmic',
      h1_condicions: 'Condicions de venda',
      cos_condicions: "La redacció final d'aquest text (incloent el tractament del dret de desistiment, art. 103.l TRLGDCU per a serveis amb data i hora concretes de prestació) està pendent de validació amb l'assessoria legal. Aquesta pàgina és un placeholder perquè l'enllaç del formulari no quedi trencat.",

      titol_privacitat: 'Política de privacitat — Espai Econòmic',
      h1_privacitat: 'Política de privacitat',
      cos_privacitat: "La redacció final d'aquest text (avís legal LSSICE, RGPD/LOPDGDD, política de cookies) està pendent de validació amb l'assessoria legal. Aquesta pàgina és un placeholder perquè l'enllaç del formulari no quedi trencat.",

      titol_cookies: 'Política de cookies — Espai Econòmic',
      h1_cookies: 'Política de cookies',
      cos_cookies_p1: "La redacció final d'aquest text està pendent de validació amb l'assessoria legal.",
      cos_cookies_p2: "Nota tècnica per a qui redacti el text: aquest portal no fa servir cookies pròpies (no hi ha sessions d'usuari ni analítica instal·lada). L'única petició a tercers és la càrrega de la tipografia Inter des de Google Fonts (fonts.googleapis.com / fonts.gstatic.com), que implica l'enviament de la IP del visitant a Google. Convé que l'assessoria valori si cal esment específic d'això a la política de cookies/privacitat, o si es prefereix allotjar la tipografia localment per evitar-ho.",
    },
    es: {
      titol_index: 'Espai Econòmic — Reserva tu entrada',
      selector_titol: 'Elige el evento',
      selector_subtitol: 'Ahora mismo hay varias reservas abiertas. Elige a cuál quieres apuntarte.',
      breadcrumb_tornar: '‹ Todos los eventos',
      eyebrow_mes: 'Evento del mes',
      evento_carregant: 'Cargando el evento…',
      form_titol: 'Reserva tu plaza',
      form_subtitol: 'Paga de forma segura con tarjeta.',
      label_cantidad: 'Número de entradas',
      label_nom: 'Nombre y apellidos',
      label_email: 'Email',
      label_telefon: 'Teléfono',
      checkbox_factura: 'Quiero factura con datos fiscales',
      label_nif: 'NIF / CIF',
      label_nom_fiscal: 'Nombre fiscal',
      label_direccio_fiscal: 'Dirección fiscal',
      accepta_pre: 'Acepto las ',
      accepta_condicions: 'condiciones de venta',
      accepta_i: ' y la ',
      accepta_privacitat: 'política de privacidad',
      btn_comprar: 'Pagar y reservar entrada',
      btn_comprar_processant: 'Procesando…',
      pagament_divider: 'métodos de pago aceptados',
      footer_avis: 'Aviso legal',
      footer_privacitat: 'Privacidad',
      footer_cookies: 'Cookies',
      footer_condicions: 'Condiciones de venta',
      modal_tanca: 'Cerrar',
      modal_carregant: 'Cargando…',
      modal_error: 'No se ha podido cargar el contenido.',

      motiu_no_event: 'Ahora mismo no hay ningún evento abierto para la venta de entradas.',
      motiu_data_limit: 'El plazo de compra para este evento ha finalizado.',
      motiu_aforament: 'Las entradas para este evento se han agotado.',
      motiu_default: 'La compra no está disponible ahora mismo.',
      sense_places: 'Sin plazas disponibles',
      evento_default_desc: 'Vuelve pronto para ver el próximo evento.',
      suffix_entrada: ' / entrada',
      places_disponibles: 'plazas disponibles',
      error_connexio: 'No se ha podido conectar con el servidor. Vuelve a intentarlo.',
      error_inesperat: 'Error inesperado.',

      titol_success: 'Compra confirmada — Espai Econòmic',
      eyebrow_pagament_rebut: 'Pago recibido',
      gracies_compra: '¡Gracias por tu compra!',
      rebras_confirmacio: 'Recibirás la confirmación de tu entrada por email en breve.',
      reserva_confirmada: 'Reserva confirmada',
      pots_tancar: 'Ya puedes cerrar esta ventana. ¡Nos vemos en el evento!',
      tornar_inici: 'Volver al inicio',

      titol_cancel: 'Pago cancelado — Espai Econòmic',
      eyebrow_no_complet: 'Pago no completado',
      pagament_cancelat: 'El pago se ha cancelado',
      sense_carrec: 'No se ha realizado ningún cargo. Tu plaza no ha quedado reservada.',
      torna_provar: 'Vuelve a intentarlo',
      pots_tornar: 'Puedes volver al inicio y completar la compra cuando quieras, siempre que queden plazas.',

      titol_avis_legal: 'Aviso legal — Espai Econòmic',
      h1_avis_legal: 'Aviso legal',
      cos_pendent_titol: 'Contenido pendiente.',
      cos_avis_legal: 'La redacción final de este texto (identificación del titular según la LSSICE: razón social, NIF, domicilio, datos de contacto e inscripción registral si aplica) está pendiente de validación con la asesoría legal. Esta página es un placeholder para que no quede ningún enlace legal roto.',

      titol_condicions: 'Condiciones de venta — Espai Econòmic',
      h1_condicions: 'Condiciones de venta',
      cos_condicions: 'La redacción final de este texto (incluyendo el tratamiento del derecho de desistimiento, art. 103.l TRLGDCU para servicios con fecha y hora concretas de prestación) está pendiente de validación con la asesoría legal. Esta página es un placeholder para que el enlace del formulario no quede roto.',

      titol_privacitat: 'Política de privacidad — Espai Econòmic',
      h1_privacitat: 'Política de privacidad',
      cos_privacitat: 'La redacción final de este texto (aviso legal LSSICE, RGPD/LOPDGDD, política de cookies) está pendiente de validación con la asesoría legal. Esta página es un placeholder para que el enlace del formulario no quede roto.',

      titol_cookies: 'Política de cookies — Espai Econòmic',
      h1_cookies: 'Política de cookies',
      cos_cookies_p1: 'La redacción final de este texto está pendiente de validación con la asesoría legal.',
      cos_cookies_p2: 'Nota técnica para quien redacte el texto: este portal no utiliza cookies propias (no hay sesiones de usuario ni analítica instalada). La única petición a terceros es la carga de la tipografía Inter desde Google Fonts (fonts.googleapis.com / fonts.gstatic.com), lo que implica el envío de la IP del visitante a Google. Conviene que la asesoría valore si es necesaria una mención específica de esto en la política de cookies/privacidad, o si se prefiere alojar la tipografía localmente para evitarlo.',
    },
    en: {
      titol_index: 'Espai Econòmic — Book your ticket',
      selector_titol: 'Choose the event',
      selector_subtitol: "There are currently several open bookings. Choose which one you'd like to join.",
      breadcrumb_tornar: '‹ All events',
      eyebrow_mes: 'Event of the month',
      evento_carregant: 'Loading the event…',
      form_titol: 'Book your spot',
      form_subtitol: 'Pay securely by card.',
      label_cantidad: 'Number of tickets',
      label_nom: 'Full name',
      label_email: 'Email',
      label_telefon: 'Phone',
      checkbox_factura: 'I want an invoice with tax details',
      label_nif: 'Tax ID',
      label_nom_fiscal: 'Billing name',
      label_direccio_fiscal: 'Billing address',
      accepta_pre: 'I accept the ',
      accepta_condicions: 'terms of sale',
      accepta_i: ' and the ',
      accepta_privacitat: 'privacy policy',
      btn_comprar: 'Pay and book ticket',
      btn_comprar_processant: 'Processing…',
      pagament_divider: 'accepted payment methods',
      footer_avis: 'Legal notice',
      footer_privacitat: 'Privacy',
      footer_cookies: 'Cookies',
      footer_condicions: 'Terms of sale',
      modal_tanca: 'Close',
      modal_carregant: 'Loading…',
      modal_error: 'The content could not be loaded.',

      motiu_no_event: 'There is currently no open event for ticket sales.',
      motiu_data_limit: 'The purchase window for this event has ended.',
      motiu_aforament: 'Tickets for this event have sold out.',
      motiu_default: 'Purchases are not available right now.',
      sense_places: 'No spots available',
      evento_default_desc: 'Check back soon for the next event.',
      suffix_entrada: ' / ticket',
      places_disponibles: 'spots available',
      error_connexio: 'Could not connect to the server. Please try again.',
      error_inesperat: 'Unexpected error.',

      titol_success: 'Purchase confirmed — Espai Econòmic',
      eyebrow_pagament_rebut: 'Payment received',
      gracies_compra: 'Thank you for your purchase!',
      rebras_confirmacio: "You'll receive your ticket confirmation by email shortly.",
      reserva_confirmada: 'Booking confirmed',
      pots_tancar: 'You can close this window now. See you at the event!',
      tornar_inici: 'Back to home',

      titol_cancel: 'Payment cancelled — Espai Econòmic',
      eyebrow_no_complet: 'Payment not completed',
      pagament_cancelat: 'The payment was cancelled',
      sense_carrec: 'No charge was made. Your spot has not been reserved.',
      torna_provar: 'Try again',
      pots_tornar: 'You can go back to the homepage and complete your purchase anytime, as long as spots remain.',

      titol_avis_legal: 'Legal notice — Espai Econòmic',
      h1_avis_legal: 'Legal notice',
      cos_pendent_titol: 'Content pending.',
      cos_avis_legal: "The final wording of this text (identification of the owner under LSSICE: company name, tax ID, address, contact details and registry entry if applicable) is pending validation with legal counsel. This page is a placeholder so that no legal link is left broken.",

      titol_condicions: 'Terms of sale — Espai Econòmic',
      h1_condicions: 'Terms of sale',
      cos_condicions: 'The final wording of this text (including the treatment of the right of withdrawal, art. 103.l TRLGDCU for services with a specific date and time of provision) is pending validation with legal counsel. This page is a placeholder so that the form link is not left broken.',

      titol_privacitat: 'Privacy policy — Espai Econòmic',
      h1_privacitat: 'Privacy policy',
      cos_privacitat: 'The final wording of this text (LSSICE legal notice, GDPR/LOPDGDD, cookie policy) is pending validation with legal counsel. This page is a placeholder so that the form link is not left broken.',

      titol_cookies: 'Cookie policy — Espai Econòmic',
      h1_cookies: 'Cookie policy',
      cos_cookies_p1: 'The final wording of this text is pending validation with legal counsel.',
      cos_cookies_p2: "Technical note for whoever drafts the text: this portal does not use its own cookies (there are no user sessions or analytics installed). The only third-party request is loading the Inter typeface from Google Fonts (fonts.googleapis.com / fonts.gstatic.com), which involves sending the visitor's IP to Google. Legal counsel should assess whether a specific mention of this is needed in the cookie/privacy policy, or whether to host the typeface locally to avoid it.",
    },
  };

  function idiomaActual() {
    const guardat = localStorage.getItem(CLAU_STORAGE);
    return IDIOMES.includes(guardat) ? guardat : 'ca';
  }

  function t(clau) {
    const idioma = idiomaActual();
    return (TRADUCCIONS[idioma] && TRADUCCIONS[idioma][clau]) || TRADUCCIONS.ca[clau] || clau;
  }

  function localeActual() {
    return LOCALES[idiomaActual()];
  }

  function elementsAmb(arrel, selector) {
    const abast = arrel || document;
    const propis = abast.matches && abast.matches(selector) ? [abast] : [];
    return propis.concat(Array.from(abast.querySelectorAll(selector)));
  }

  function aplicarTraduccions(arrel) {
    const idioma = idiomaActual();
    if (!arrel) document.documentElement.lang = idioma;
    elementsAmb(arrel, '[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    elementsAmb(arrel, '[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('.menu-idioma-btn').forEach((b) => {
      b.classList.toggle('menu-idioma-btn--actiu', b.dataset.idioma === idioma);
    });
  }

  function crearEstils() {
    const style = document.createElement('style');
    style.textContent = `
      .menu-idioma {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 100;
        display: flex;
        gap: 2px;
        background: rgba(34, 31, 30, 0.94);
        border-radius: 999px;
        padding: 4px;
        box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.45);
        font-family: 'Inter', sans-serif;
      }
      .menu-idioma-btn {
        border: none;
        background: transparent;
        color: rgba(242, 239, 238, 0.65);
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.02em;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 150ms ease-out, color 150ms ease-out;
      }
      .menu-idioma-btn:hover {
        color: #F2EFEE;
        background: rgba(242, 239, 238, 0.12);
      }
      .menu-idioma-btn--actiu {
        background: #F2EFEE;
        color: #221F1E;
      }
      @media (max-width: 480px) {
        .menu-idioma { top: 10px; right: 10px; }
        .menu-idioma-btn { padding: 5px 9px; font-size: 11px; }
      }
    `;
    document.head.appendChild(style);
  }

  function crearMenu() {
    const menu = document.createElement('div');
    menu.className = 'menu-idioma';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', "Selector d'idioma");
    menu.innerHTML = IDIOMES.map((id) => `<button type="button" class="menu-idioma-btn" data-idioma="${id}">${ETIQUETES[id]}</button>`).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('.menu-idioma-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        localStorage.setItem(CLAU_STORAGE, btn.dataset.idioma);
        aplicarTraduccions();
        document.dispatchEvent(new CustomEvent('idiomaCanviat'));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    crearEstils();
    crearMenu();
    aplicarTraduccions();
  });

  window.i18n = { t, idiomaActual, localeActual, aplicar: aplicarTraduccions };
})();
