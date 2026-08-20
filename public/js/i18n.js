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
      avis_dos_correus: 'Com que has demanat factura, rebràs dos correus: la confirmació de la teva entrada i, més endavant, la factura.',
      reserva_confirmada: 'Reserva confirmada',
      pots_tancar: "Ja pots tancar aquesta finestra. Ens veiem a l'esdeveniment!",
      com_cancelar_modificar: 'Si necessites cancel·lar o modificar la teva entrada, escriu-nos a <a href="mailto:anna@uauu.cat">anna@uauu.cat</a> i t\'ajudarem.',
      tornar_inici: "Tornar a l'inici",

      titol_cancel: 'Pagament cancel·lat — Espai Econòmic',
      eyebrow_no_complet: 'Pagament no completat',
      pagament_cancelat: "El pagament s'ha cancel·lat",
      sense_carrec: 'No s\'ha realitzat cap càrrec. La teva plaça no ha quedat reservada.',
      torna_provar: 'Torna-ho a provar',
      pots_tornar: 'Pots tornar a l\'inici i completar la compra quan vulguis, sempre que quedin places.',

      titol_avis_legal: 'Avís legal — Espai Econòmic',
      h1_avis_legal: 'Avís legal',
      avis_legal_intro: "En compliment del deure d'informació de l'article 10 de la Llei 34/2002, d'11 de juliol, de Serveis de la Societat de la Informació i de Comerç Electrònic (LSSICE), es faciliten a continuació les dades identificatives del titular d'aquest lloc web.",
      avis_legal_titular_titol: 'Dades identificatives',
      avis_legal_titular_p: 'Titular: [NOM_LEGAL_TITULAR]. NIF/CIF: [NIF_CIF]. Domicili social: [DOMICILI_SOCIAL]. Correu electrònic de contacte: [EMAIL_CONTACTE]. Telèfon: [TELEFON_CONTACTE]. Inscripció registral (si escau): [REGISTRE_MERCANTIL].',
      avis_legal_objecte_titol: 'Objecte',
      avis_legal_objecte_p: 'Aquest lloc web ("el Portal") té per objecte la difusió d\'informació sobre els esdeveniments organitzats per [NOM_LEGAL_TITULAR] sota el nom comercial "Espai Econòmic", així com la gestió de la reserva i venda d\'entrades per a aquests esdeveniments.',
      avis_legal_condicions_titol: "Condicions d'accés i ús",
      avis_legal_condicions_p: "L'accés al Portal és gratuït i no requereix subscripció prèvia, excepte per completar el procés de compra d'entrades. L'usuari es compromet a fer un ús adequat i lícit del Portal, d'acord amb la legislació aplicable, la bona fe i l'ordre públic.",
      avis_legal_pi_titol: 'Propietat intel·lectual i industrial',
      avis_legal_pi_p: "Els continguts del Portal (textos, imatges, dissenys, logotips, codi font i qualsevol altre element) són propietat de [NOM_LEGAL_TITULAR] o de tercers que n'han autoritzat l'ús. Queda prohibida la seva reproducció, distribució o transformació sense autorització prèvia i expressa.",
      avis_legal_responsabilitat_titol: 'Responsabilitat',
      avis_legal_responsabilitat_p: "[NOM_LEGAL_TITULAR] no es fa responsable de les interrupcions o errors tècnics que puguin produir-se durant l'accés al Portal, sense perjudici dels drets que corresponguin a l'usuari segons la normativa de consum aplicable.",
      avis_legal_llei_titol: 'Legislació aplicable',
      avis_legal_llei_p: 'Aquest Avís Legal es regeix per la legislació espanyola. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals que correspongui segons la normativa de protecció de consumidors i usuaris.',

      titol_condicions: 'Condicions de venda — Espai Econòmic',
      h1_condicions: 'Condicions de venda',
      condicions_intro: "Aquestes condicions regulen la venda d'entrades per als esdeveniments d'Espai Econòmic a través d'aquest Portal. La compra d'una entrada implica l'acceptació íntegra d'aquestes condicions.",
      condicions_venedor_titol: 'Identificació del venedor',
      condicions_venedor_p: 'El venedor és [NOM_LEGAL_TITULAR], NIF [NIF_CIF], amb domicili a [DOMICILI_SOCIAL]. Contacte: [EMAIL_CONTACTE].',
      condicions_proces_titol: 'Procés de compra i preu',
      condicions_proces_p: "Selecciona l'esdeveniment, el nombre d'entrades, i completa el formulari amb les teves dades. El preu final es mostra abans de confirmar el pagament [PENDENT: precisar si el preu inclou l'IVA]. La compra es considera formalitzada quan Stripe confirma el pagament.",
      condicions_pagament_titol: 'Forma de pagament',
      condicions_pagament_p: 'El pagament es realitza amb targeta a través de la passarel·la segura de Stripe. Cap dada de la targeta es processa ni s\'emmagatzema als nostres servidors.',
      condicions_confirmacio_titol: 'Confirmació de la reserva',
      condicions_confirmacio_p: 'Un cop confirmat el pagament, la plaça queda reservada. [PENDENT: precisar si s\'envia un email de confirmació/entrada i per quin mitjà.]',
      condicions_desistiment_titol: 'Dret de desistiment',
      condicions_desistiment_p: "D'acord amb l'article 103.l) del Reial Decret Legislatiu 1/2007 (TRLGDCU), el dret de desistiment de 14 dies naturals no és aplicable a la prestació de serveis relacionats amb activitats d'oci que es realitzin en una data o període d'execució específics, com és el cas dels esdeveniments d'aquest Portal.",
      condicions_cancelacions_titol: 'Cancel·lacions i canvis per part del client',
      condicions_cancelacions_p: '[PENDENT: definir la política de cancel·lació, canvi o reemborsament per part del client, si n\'existeix alguna, i el termini per sol·licitar-la.]',
      condicions_modificacio_titol: "Modificació o cancel·lació de l'esdeveniment",
      condicions_modificacio_p: "[NOM_LEGAL_TITULAR] es reserva el dret de modificar la data, l'hora o el contingut de l'esdeveniment, o de cancel·lar-lo per causes justificades (incloent força major). [PENDENT: definir la política de reemborsament en aquest cas.]",
      condicions_aforament_titol: 'Aforament',
      condicions_aforament_p: 'Cada esdeveniment té un aforament limitat. Un cop exhaurides les entrades disponibles, la compra quedarà tancada automàticament.',
      condicions_reclamacions_titol: 'Reclamacions',
      condicions_reclamacions_p: 'Pots dirigir qualsevol reclamació a [EMAIL_CONTACTE]. [PENDENT: indicar si es disposa de fulls oficials de reclamació.]',
      condicions_llei_titol: 'Llei aplicable i jurisdicció',
      condicions_llei_p: 'Aquestes condicions es regeixen per la legislació espanyola. Sense perjudici del dret dels consumidors a acudir al seu propi fur, les parts podran sotmetre\'s als jutjats i tribunals que correspongui segons la normativa de protecció de consumidors i usuaris.',

      titol_privacitat: 'Política de privacitat — Espai Econòmic',
      h1_privacitat: 'Política de privacitat',
      privacitat_intro: "En compliment del Reglament (UE) 2016/679 (RGPD) i de la Llei Orgànica 3/2018 de Protecció de Dades Personals i garantia dels drets digitals (LOPDGDD), s'informa dels aspectes següents relatius al tractament de les dades personals recollides a través d'aquest Portal.",
      privacitat_responsable_titol: 'Responsable del tractament',
      privacitat_responsable_p: '[NOM_LEGAL_TITULAR], NIF [NIF_CIF], domicili a [DOMICILI_SOCIAL]. Contacte: [EMAIL_CONTACTE].',
      privacitat_dades_titol: 'Quines dades recollim',
      privacitat_dades_p: "Quan compres una entrada, recollim el nom i cognoms, l'adreça de correu electrònic, el telèfon i el nombre d'entrades sol·licitades. Si demanes factura amb dades fiscals, recollim també el NIF/CIF, el nom fiscal i l'adreça fiscal. No recollim dades de la teva targeta de pagament: el pagament es gestiona íntegrament a través de Stripe, que les rep directament.",
      privacitat_finalitat_titol: 'Finalitat i base legítima',
      privacitat_finalitat_p: "Tractem les teves dades per gestionar la reserva i venda de l'entrada (execució d'un contracte, art. 6.1.b RGPD) i, si escau, per emetre la factura corresponent (compliment d'una obligació legal, art. 6.1.c RGPD).",
      privacitat_conservacio_titol: 'Durant quant de temps les conservem',
      privacitat_conservacio_p: "Conservem les dades associades a una compra durant el temps necessari per gestionar l'esdeveniment i, posteriorment, durant el termini exigit per la normativa mercantil i tributària per a la conservació de justificants i factures (com a mínim 6 anys).",
      privacitat_destinataris_titol: 'A qui es comuniquen les dades',
      privacitat_destinataris_p: "Compartim les dades necessàries amb Stripe, Inc. (processament del pagament) i Supabase (allotjament de la base de dades, servidors a la Unió Europea), com a encarregats del tractament. No cedim ni venem les teves dades a tercers amb finalitats comercials o publicitàries.",
      privacitat_transferencies_titol: 'Transferències internacionals',
      privacitat_transferencies_p: 'Stripe pot implicar el tractament de dades fora de l\'Espai Econòmic Europeu, sempre emparat per les garanties del RGPD (com les Clàusules Contractuals Tipus). Pots consultar la política de privacitat de Stripe a stripe.com/privacy.',
      privacitat_drets_titol: 'Quins són els teus drets',
      privacitat_drets_p: "Pots exercir en qualsevol moment els drets d'accés, rectificació, supressió, limitació, portabilitat i oposició escrivint a [EMAIL_CONTACTE]. També tens dret a reclamar davant l'Agència Espanyola de Protecció de Dades (www.aepd.es).",
      privacitat_seguretat_titol: 'Seguretat',
      privacitat_seguretat_p: "Apliquem les mesures tècniques i organitzatives adequades per protegir les teves dades. El pagament es realitza a través de Stripe Checkout, un entorn certificat PCI-DSS; el nostre servidor no emmagatzema ni processa mai les dades de la teva targeta.",
      privacitat_menors_titol: "Menors d'edat",
      privacitat_menors_p: 'Els serveis d\'aquest Portal no estan dirigits a menors de 14 anys. Si ets menor d\'aquesta edat, no ens facilitis les teves dades sense el consentiment del pare, mare o tutor legal.',

      titol_cookies: 'Política de cookies — Espai Econòmic',
      h1_cookies: 'Política de cookies',
      cookies_intro: "Una cookie és un petit fitxer que un lloc web pot desar al teu navegador quan el visites. A continuació t'expliquem quines cookies fem servir en aquest Portal.",
      cookies_propies_titol: 'Cookies pròpies',
      cookies_propies_p: "Les pàgines públiques de venda d'entrades d'aquest Portal no utilitzen cap cookie pròpia: no hi ha sessions d'usuari ni eines d'analítica instal·lades. Únicament el panell d'administració intern, d'ús exclusiu del personal autoritzat, utilitza una cookie tècnica de sessió (admin_session) estrictament necessària per mantenir l'accés autenticat, exempta del deure de consentiment segons l'article 22.2 de la LSSICE.",
      cookies_tercers_titol: 'Cookies de tercers',
      cookies_tercers_p: 'La tipografia del lloc es carrega des de Google Fonts (fonts.googleapis.com i fonts.gstatic.com), la qual cosa implica l\'enviament de la teva adreça IP a Google en carregar la pàgina. Durant el procés de pagament, Stripe (checkout.stripe.com) pot establir les seves pròpies cookies tècniques, necessàries per garantir la seguretat de la transacció i la prevenció del frau.',
      cookies_gestio_titol: 'Com gestionar les cookies',
      cookies_gestio_p: "Pots configurar el teu navegador per bloquejar o eliminar les cookies en qualsevol moment; tingues en compte que això pot afectar el funcionament del procés de pagament. Consulta les opcions d'ajuda del teu navegador per a més informació.",
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
      avis_dos_correus: 'Como has pedido factura, recibirás dos correos: la confirmación de tu entrada y, más adelante, la factura.',
      reserva_confirmada: 'Reserva confirmada',
      pots_tancar: 'Ya puedes cerrar esta ventana. ¡Nos vemos en el evento!',
      com_cancelar_modificar: 'Si necesitas cancelar o modificar tu entrada, escríbenos a <a href="mailto:anna@uauu.cat">anna@uauu.cat</a> y te ayudaremos.',
      tornar_inici: 'Volver al inicio',

      titol_cancel: 'Pago cancelado — Espai Econòmic',
      eyebrow_no_complet: 'Pago no completado',
      pagament_cancelat: 'El pago se ha cancelado',
      sense_carrec: 'No se ha realizado ningún cargo. Tu plaza no ha quedado reservada.',
      torna_provar: 'Vuelve a intentarlo',
      pots_tornar: 'Puedes volver al inicio y completar la compra cuando quieras, siempre que queden plazas.',

      titol_avis_legal: 'Aviso legal — Espai Econòmic',
      h1_avis_legal: 'Aviso legal',
      avis_legal_intro: 'En cumplimiento del deber de información del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSICE), se facilitan a continuación los datos identificativos del titular de este sitio web.',
      avis_legal_titular_titol: 'Datos identificativos',
      avis_legal_titular_p: 'Titular: [NOM_LEGAL_TITULAR]. NIF/CIF: [NIF_CIF]. Domicilio social: [DOMICILI_SOCIAL]. Correo electrónico de contacto: [EMAIL_CONTACTE]. Teléfono: [TELEFON_CONTACTE]. Inscripción registral (si procede): [REGISTRE_MERCANTIL].',
      avis_legal_objecte_titol: 'Objeto',
      avis_legal_objecte_p: 'Este sitio web ("el Portal") tiene por objeto la difusión de información sobre los eventos organizados por [NOM_LEGAL_TITULAR] bajo el nombre comercial "Espai Econòmic", así como la gestión de la reserva y venta de entradas para dichos eventos.',
      avis_legal_condicions_titol: 'Condiciones de acceso y uso',
      avis_legal_condicions_p: 'El acceso al Portal es gratuito y no requiere suscripción previa, salvo para completar el proceso de compra de entradas. El usuario se compromete a hacer un uso adecuado y lícito del Portal, conforme a la legislación aplicable, la buena fe y el orden público.',
      avis_legal_pi_titol: 'Propiedad intelectual e industrial',
      avis_legal_pi_p: 'Los contenidos del Portal (textos, imágenes, diseños, logotipos, código fuente y cualquier otro elemento) son propiedad de [NOM_LEGAL_TITULAR] o de terceros que han autorizado su uso. Queda prohibida su reproducción, distribución o transformación sin autorización previa y expresa.',
      avis_legal_responsabilitat_titol: 'Responsabilidad',
      avis_legal_responsabilitat_p: '[NOM_LEGAL_TITULAR] no se hace responsable de las interrupciones o errores técnicos que puedan producirse durante el acceso al Portal, sin perjuicio de los derechos que correspondan al usuario según la normativa de consumo aplicable.',
      avis_legal_llei_titol: 'Legislación aplicable',
      avis_legal_llei_p: 'Este Aviso Legal se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan según la normativa de protección de consumidores y usuarios.',

      titol_condicions: 'Condiciones de venta — Espai Econòmic',
      h1_condicions: 'Condiciones de venta',
      condicions_intro: 'Estas condiciones regulan la venta de entradas para los eventos de Espai Econòmic a través de este Portal. La compra de una entrada implica la aceptación íntegra de estas condiciones.',
      condicions_venedor_titol: 'Identificación del vendedor',
      condicions_venedor_p: 'El vendedor es [NOM_LEGAL_TITULAR], NIF [NIF_CIF], con domicilio en [DOMICILI_SOCIAL]. Contacto: [EMAIL_CONTACTE].',
      condicions_proces_titol: 'Proceso de compra y precio',
      condicions_proces_p: 'Selecciona el evento, el número de entradas, y completa el formulario con tus datos. El precio final se muestra antes de confirmar el pago [PENDIENTE: precisar si el precio incluye el IVA]. La compra se considera formalizada cuando Stripe confirma el pago.',
      condicions_pagament_titol: 'Forma de pago',
      condicions_pagament_p: 'El pago se realiza con tarjeta a través de la pasarela segura de Stripe. Ningún dato de la tarjeta se procesa ni se almacena en nuestros servidores.',
      condicions_confirmacio_titol: 'Confirmación de la reserva',
      condicions_confirmacio_p: 'Una vez confirmado el pago, la plaza queda reservada. [PENDIENTE: precisar si se envía un email de confirmación/entrada y por qué medio.]',
      condicions_desistiment_titol: 'Derecho de desistimiento',
      condicions_desistiment_p: 'De acuerdo con el artículo 103.l) del Real Decreto Legislativo 1/2007 (TRLGDCU), el derecho de desistimiento de 14 días naturales no es aplicable a la prestación de servicios relacionados con actividades de ocio que se realicen en una fecha o periodo de ejecución específicos, como es el caso de los eventos de este Portal.',
      condicions_cancelacions_titol: 'Cancelaciones y cambios por parte del cliente',
      condicions_cancelacions_p: '[PENDIENTE: definir la política de cancelación, cambio o reembolso por parte del cliente, si existe alguna, y el plazo para solicitarla.]',
      condicions_modificacio_titol: 'Modificación o cancelación del evento',
      condicions_modificacio_p: '[NOM_LEGAL_TITULAR] se reserva el derecho de modificar la fecha, la hora o el contenido del evento, o de cancelarlo por causas justificadas (incluyendo fuerza mayor). [PENDIENTE: definir la política de reembolso en este caso.]',
      condicions_aforament_titol: 'Aforo',
      condicions_aforament_p: 'Cada evento tiene un aforo limitado. Una vez agotadas las entradas disponibles, la compra quedará cerrada automáticamente.',
      condicions_reclamacions_titol: 'Reclamaciones',
      condicions_reclamacions_p: 'Puedes dirigir cualquier reclamación a [EMAIL_CONTACTE]. [PENDIENTE: indicar si se dispone de hojas oficiales de reclamación.]',
      condicions_llei_titol: 'Ley aplicable y jurisdicción',
      condicions_llei_p: 'Estas condiciones se rigen por la legislación española. Sin perjuicio del derecho de los consumidores a acudir a su propio fuero, las partes podrán someterse a los juzgados y tribunales que correspondan según la normativa de protección de consumidores y usuarios.',

      titol_privacitat: 'Política de privacidad — Espai Econòmic',
      h1_privacitat: 'Política de privacidad',
      privacitat_intro: 'En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y de la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), se informa de los siguientes aspectos relativos al tratamiento de los datos personales recogidos a través de este Portal.',
      privacitat_responsable_titol: 'Responsable del tratamiento',
      privacitat_responsable_p: '[NOM_LEGAL_TITULAR], NIF [NIF_CIF], domicilio en [DOMICILI_SOCIAL]. Contacto: [EMAIL_CONTACTE].',
      privacitat_dades_titol: 'Qué datos recogemos',
      privacitat_dades_p: 'Cuando compras una entrada, recogemos el nombre y apellidos, la dirección de correo electrónico, el teléfono y el número de entradas solicitadas. Si pides factura con datos fiscales, recogemos también el NIF/CIF, el nombre fiscal y la dirección fiscal. No recogemos datos de tu tarjeta de pago: el pago se gestiona íntegramente a través de Stripe, que los recibe directamente.',
      privacitat_finalitat_titol: 'Finalidad y base legítima',
      privacitat_finalitat_p: 'Tratamos tus datos para gestionar la reserva y venta de la entrada (ejecución de un contrato, art. 6.1.b RGPD) y, en su caso, para emitir la factura correspondiente (cumplimiento de una obligación legal, art. 6.1.c RGPD).',
      privacitat_conservacio_titol: 'Durante cuánto tiempo los conservamos',
      privacitat_conservacio_p: 'Conservamos los datos asociados a una compra durante el tiempo necesario para gestionar el evento y, posteriormente, durante el plazo exigido por la normativa mercantil y tributaria para la conservación de justificantes y facturas (como mínimo 6 años).',
      privacitat_destinataris_titol: 'A quién se comunican los datos',
      privacitat_destinataris_p: 'Compartimos los datos necesarios con Stripe, Inc. (procesamiento del pago) y Supabase (alojamiento de la base de datos, servidores en la Unión Europea), como encargados del tratamiento. No cedemos ni vendemos tus datos a terceros con fines comerciales o publicitarios.',
      privacitat_transferencies_titol: 'Transferencias internacionales',
      privacitat_transferencies_p: 'Stripe puede implicar el tratamiento de datos fuera del Espacio Económico Europeo, siempre amparado por las garantías del RGPD (como las Cláusulas Contractuales Tipo). Puedes consultar la política de privacidad de Stripe en stripe.com/privacy.',
      privacitat_drets_titol: 'Cuáles son tus derechos',
      privacitat_drets_p: 'Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a [EMAIL_CONTACTE]. También tienes derecho a reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      privacitat_seguretat_titol: 'Seguridad',
      privacitat_seguretat_p: 'Aplicamos las medidas técnicas y organizativas adecuadas para proteger tus datos. El pago se realiza a través de Stripe Checkout, un entorno certificado PCI-DSS; nuestro servidor no almacena ni procesa nunca los datos de tu tarjeta.',
      privacitat_menors_titol: 'Menores de edad',
      privacitat_menors_p: 'Los servicios de este Portal no están dirigidos a menores de 14 años. Si eres menor de esta edad, no nos facilites tus datos sin el consentimiento de tu padre, madre o tutor legal.',

      titol_cookies: 'Política de cookies — Espai Econòmic',
      h1_cookies: 'Política de cookies',
      cookies_intro: 'Una cookie es un pequeño archivo que un sitio web puede guardar en tu navegador cuando lo visitas. A continuación te explicamos qué cookies utilizamos en este Portal.',
      cookies_propies_titol: 'Cookies propias',
      cookies_propies_p: 'Las páginas públicas de venta de entradas de este Portal no utilizan ninguna cookie propia: no hay sesiones de usuario ni herramientas de analítica instaladas. Únicamente el panel de administración interno, de uso exclusivo del personal autorizado, utiliza una cookie técnica de sesión (admin_session) estrictamente necesaria para mantener el acceso autenticado, exenta del deber de consentimiento según el artículo 22.2 de la LSSICE.',
      cookies_tercers_titol: 'Cookies de terceros',
      cookies_tercers_p: 'La tipografía del sitio se carga desde Google Fonts (fonts.googleapis.com y fonts.gstatic.com), lo que implica el envío de tu dirección IP a Google al cargar la página. Durante el proceso de pago, Stripe (checkout.stripe.com) puede establecer sus propias cookies técnicas, necesarias para garantizar la seguridad de la transacción y la prevención del fraude.',
      cookies_gestio_titol: 'Cómo gestionar las cookies',
      cookies_gestio_p: 'Puedes configurar tu navegador para bloquear o eliminar las cookies en cualquier momento; ten en cuenta que esto puede afectar al funcionamiento del proceso de pago. Consulta las opciones de ayuda de tu navegador para más información.',
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
      avis_dos_correus: "Since you requested an invoice, you'll receive two emails: your ticket confirmation and, later on, the invoice.",
      reserva_confirmada: 'Booking confirmed',
      pots_tancar: 'You can close this window now. See you at the event!',
      com_cancelar_modificar: 'If you need to cancel or modify your ticket, email us at <a href="mailto:anna@uauu.cat">anna@uauu.cat</a> and we\'ll help you.',
      tornar_inici: 'Back to home',

      titol_cancel: 'Payment cancelled — Espai Econòmic',
      eyebrow_no_complet: 'Payment not completed',
      pagament_cancelat: 'The payment was cancelled',
      sense_carrec: 'No charge was made. Your spot has not been reserved.',
      torna_provar: 'Try again',
      pots_tornar: 'You can go back to the homepage and complete your purchase anytime, as long as spots remain.',

      titol_avis_legal: 'Legal notice — Espai Econòmic',
      h1_avis_legal: 'Legal notice',
      avis_legal_intro: 'In compliance with the duty of information under article 10 of Spanish Law 34/2002, of 11 July, on Information Society Services and Electronic Commerce (LSSICE), the identification details of the owner of this website are provided below.',
      avis_legal_titular_titol: 'Identification details',
      avis_legal_titular_p: 'Owner: [NOM_LEGAL_TITULAR]. Tax ID: [NIF_CIF]. Registered address: [DOMICILI_SOCIAL]. Contact email: [EMAIL_CONTACTE]. Phone: [TELEFON_CONTACTE]. Company registry entry (if applicable): [REGISTRE_MERCANTIL].',
      avis_legal_objecte_titol: 'Purpose',
      avis_legal_objecte_p: 'This website ("the Site") is intended to publish information about the events organised by [NOM_LEGAL_TITULAR] under the trade name "Espai Econòmic", and to manage the booking and sale of tickets for those events.',
      avis_legal_condicions_titol: 'Access and use conditions',
      avis_legal_condicions_p: 'Access to the Site is free and does not require prior registration, except to complete the ticket purchase process. Users agree to make appropriate and lawful use of the Site, in accordance with applicable law, good faith and public order.',
      avis_legal_pi_titol: 'Intellectual and industrial property',
      avis_legal_pi_p: 'The contents of the Site (text, images, designs, logos, source code and any other element) are the property of [NOM_LEGAL_TITULAR] or of third parties who have authorised their use. Their reproduction, distribution or transformation without prior express authorisation is prohibited.',
      avis_legal_responsabilitat_titol: 'Liability',
      avis_legal_responsabilitat_p: '[NOM_LEGAL_TITULAR] is not liable for interruptions or technical errors that may occur while accessing the Site, without prejudice to the rights users are entitled to under applicable consumer law.',
      avis_legal_llei_titol: 'Applicable law',
      avis_legal_llei_p: 'This Legal Notice is governed by Spanish law. For any dispute, the parties submit to the courts that correspond under consumer protection regulations.',

      titol_condicions: 'Terms of sale — Espai Econòmic',
      h1_condicions: 'Terms of sale',
      condicions_intro: "These terms govern the sale of tickets for Espai Econòmic's events through this Site. Purchasing a ticket implies full acceptance of these terms.",
      condicions_venedor_titol: 'Seller identification',
      condicions_venedor_p: 'The seller is [NOM_LEGAL_TITULAR], Tax ID [NIF_CIF], registered address [DOMICILI_SOCIAL]. Contact: [EMAIL_CONTACTE].',
      condicions_proces_titol: 'Purchase process and price',
      condicions_proces_p: 'Select the event, the number of tickets, and complete the form with your details. The final price is shown before confirming payment [PENDING: specify whether the price includes VAT]. The purchase is considered completed once Stripe confirms payment.',
      condicions_pagament_titol: 'Payment method',
      condicions_pagament_p: 'Payment is made by card through Stripe\'s secure gateway. No card data is processed or stored on our servers.',
      condicions_confirmacio_titol: 'Booking confirmation',
      condicions_confirmacio_p: 'Once payment is confirmed, your spot is reserved. [PENDING: specify whether a confirmation/ticket email is sent and by what means.]',
      condicions_desistiment_titol: 'Right of withdrawal',
      condicions_desistiment_p: 'Under article 103.l) of Royal Legislative Decree 1/2007 (TRLGDCU), the 14-day right of withdrawal does not apply to the provision of services related to leisure activities carried out on a specific date or period, as is the case for the events offered on this Site.',
      condicions_cancelacions_titol: 'Cancellations and changes by the customer',
      condicions_cancelacions_p: '[PENDING: define the cancellation, change or refund policy for customers, if any, and the deadline to request it.]',
      condicions_modificacio_titol: 'Modification or cancellation of the event',
      condicions_modificacio_p: '[NOM_LEGAL_TITULAR] reserves the right to change the date, time or content of the event, or to cancel it, for justified reasons (including force majeure). [PENDING: define the refund policy that applies in this case.]',
      condicions_aforament_titol: 'Capacity',
      condicions_aforament_p: 'Each event has a limited capacity. Once the available tickets are sold out, purchasing will close automatically.',
      condicions_reclamacions_titol: 'Complaints',
      condicions_reclamacions_p: 'You can address any complaint to [EMAIL_CONTACTE]. [PENDING: state whether official complaint forms are available.]',
      condicions_llei_titol: 'Applicable law and jurisdiction',
      condicions_llei_p: 'These terms are governed by Spanish law. Without prejudice to consumers\' right to bring proceedings before their own courts, the parties may submit to the courts that correspond under consumer protection regulations.',

      titol_privacitat: 'Privacy policy — Espai Econòmic',
      h1_privacitat: 'Privacy policy',
      privacitat_intro: 'In compliance with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 on Personal Data Protection and the guarantee of digital rights (LOPDGDD), the following information concerns the processing of personal data collected through this Site.',
      privacitat_responsable_titol: 'Data controller',
      privacitat_responsable_p: '[NOM_LEGAL_TITULAR], Tax ID [NIF_CIF], registered address [DOMICILI_SOCIAL]. Contact: [EMAIL_CONTACTE].',
      privacitat_dades_titol: 'What data we collect',
      privacitat_dades_p: 'When you buy a ticket, we collect your full name, email address, phone number and the number of tickets requested. If you request an invoice with tax details, we also collect the tax ID, billing name and billing address you provide. We do not collect your payment card details: payment is handled entirely by Stripe, which receives them directly.',
      privacitat_finalitat_titol: 'Purpose and legal basis',
      privacitat_finalitat_p: 'We process your data to manage the booking and sale of the ticket (performance of a contract, art. 6.1.b GDPR) and, where applicable, to issue the corresponding invoice (compliance with a legal obligation, art. 6.1.c GDPR).',
      privacitat_conservacio_titol: 'How long we keep it',
      privacitat_conservacio_p: 'We keep the data associated with a purchase for as long as needed to manage the event and, afterwards, for the period required by commercial and tax regulations for keeping receipts and invoices (at least 6 years).',
      privacitat_destinataris_titol: 'Who receives the data',
      privacitat_destinataris_p: 'We share the necessary data with Stripe, Inc. (payment processing) and Supabase (database hosting, servers located in the European Union), as data processors. We do not transfer or sell your data to third parties for commercial or advertising purposes.',
      privacitat_transferencies_titol: 'International transfers',
      privacitat_transferencies_p: "Stripe may involve processing data outside the European Economic Area, always under the safeguards provided by the GDPR (such as the Standard Contractual Clauses). You can review Stripe's privacy policy at stripe.com/privacy.",
      privacitat_drets_titol: 'Your rights',
      privacitat_drets_p: 'You can exercise your rights of access, rectification, erasure, restriction, portability and objection at any time by writing to [EMAIL_CONTACTE]. You also have the right to lodge a complaint with the Spanish Data Protection Agency (www.aepd.es).',
      privacitat_seguretat_titol: 'Security',
      privacitat_seguretat_p: 'We apply appropriate technical and organisational measures to protect your data. Payment is made through Stripe Checkout, a PCI-DSS certified environment; our server never stores or processes your card data.',
      privacitat_menors_titol: 'Minors',
      privacitat_menors_p: 'The services offered through this Site are not aimed at children under 14. If you are under this age, please do not provide your data without the consent of a parent or legal guardian.',

      titol_cookies: 'Cookie policy — Espai Econòmic',
      h1_cookies: 'Cookie policy',
      cookies_intro: 'A cookie is a small file that a website can store on your browser when you visit it. Below we explain which cookies we use on this Site.',
      cookies_propies_titol: 'Our own cookies',
      cookies_propies_p: "This Site's public ticket-sale pages do not use any cookies of their own: there are no user sessions or analytics tools installed. Only the internal admin panel, used exclusively by authorised staff, uses a technical session cookie (admin_session) strictly necessary to keep the authenticated session, exempt from the consent requirement under article 22.2 of the LSSICE.",
      cookies_tercers_titol: 'Third-party cookies',
      cookies_tercers_p: 'The site\'s typeface is loaded from Google Fonts (fonts.googleapis.com and fonts.gstatic.com), which involves sending your IP address to Google when the page loads. During the payment process, Stripe (checkout.stripe.com) may set its own technical cookies, necessary to ensure transaction security and fraud prevention.',
      cookies_gestio_titol: 'How to manage cookies',
      cookies_gestio_p: 'You can configure your browser to block or delete cookies at any time; note that this may affect how the payment process works. Check your browser\'s help options for more information.',
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
    // Com data-i18n, però permet HTML dins la traducció (per exemple un
    // enllaç mailto:): només fer-lo servir amb claus de confiança pròpia,
    // mai amb contingut introduït per l'usuari.
    elementsAmb(arrel, '[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
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
      .menu-idioma-btn--actiu,
      .menu-idioma-btn--actiu:hover {
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
