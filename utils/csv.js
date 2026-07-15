function escaparCamp(valor) {
  let text = valor === null || valor === undefined ? '' : String(valor);
  // Neutralitza la injeccio de formules CSV (Excel/Sheets interpreten com a
  // formula qualsevol cel·la que comenci per =, +, - o @).
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(files, columnes) {
  const capsalera = columnes.map((c) => escaparCamp(c.capsalera)).join(',');
  const linies = files.map((fila) => columnes.map((c) => escaparCamp(fila[c.clau])).join(','));
  return [capsalera, ...linies].join('\r\n') + '\r\n';
}

module.exports = { toCsv };
