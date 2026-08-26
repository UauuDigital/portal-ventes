function esStringNoBuit(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Valida la llista de convidats/ponents d'un esdeveniment (dada informativa
 * que introdueix l'admin, substitueix les antigues eventos.nombre_invitado/
 * cargo_invitado — vegeu evento_invitados a config/schema.sql). Cal almenys
 * un convidat amb nom; el càrrec és opcional. No té res a veure amb
 * utils/camposFormulario.js, que valida el formulari dinàmic que respon el
 * comprador.
 */
function validarInvitados(invitados) {
  if (!Array.isArray(invitados)) {
    return ['invitados ha de ser una llista'];
  }
  if (invitados.length === 0) {
    return ['cal almenys un convidat amb nom'];
  }

  const errors = [];
  invitados.forEach((inv, i) => {
    if (!inv || typeof inv !== 'object' || !esStringNoBuit(inv.nombre)) {
      errors.push(`convidat ${i + 1}: falta el nom`);
    }
  });
  return errors;
}

module.exports = { validarInvitados };
