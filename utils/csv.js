function escaparCamp(valor) {
  const text = valor === null || valor === undefined ? '' : String(valor);
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
