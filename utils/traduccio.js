/**
 * Traducció automàtica de textos curts (títols d'esdeveniment) mitjançant
 * l'API pública i gratuïta de MyMemory (api.mymemory.translated.net). No
 * requereix clau ni compte; qualitat bàsica, adequada per a títols curts.
 * Si la crida falla (servei caigut, límit diari superat...) es retorna el
 * text original sense traduir en lloc de trencar la creació de l'esdeveniment.
 */
async function traduir(text, desti, origen = 'ca') {
  const net = (text || '').trim();
  if (!net) return net;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(net)}&langpair=${origen}|${desti}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MyMemory ha respost ${res.status}`);
    const data = await res.json();
    const traduit = data && data.responseData && data.responseData.translatedText;
    return traduit ? String(traduit) : net;
  } catch (err) {
    console.error(`Error traduint "${net}" a ${desti}:`, err.message);
    return net;
  }
}

/** Tradueix un mateix text de català a castellà i anglès en paral·lel. */
async function traduirNomEsdeveniment(nombreCa) {
  const [es, en] = await Promise.all([traduir(nombreCa, 'es'), traduir(nombreCa, 'en')]);
  return { nombre_es: es, nombre_en: en };
}

const IDIOMES = ['ca', 'es', 'en'];

/**
 * Tradueix un text des de qualsevol dels 3 idiomes cap als altres dos (per
 * al camp de "Nom" del formulari d'esdeveniment: l'usuari pot escriure'l en
 * qualsevol dels tres i es completen sols els altres dos).
 */
async function traduirATotsIdiomes(text, idiomaOrigen) {
  const desti = IDIOMES.filter((idioma) => idioma !== idiomaOrigen);
  const traduccions = await Promise.all(desti.map((idioma) => traduir(text, idioma, idiomaOrigen)));
  const resultat = { [idiomaOrigen]: text };
  desti.forEach((idioma, i) => {
    resultat[idioma] = traduccions[i];
  });
  return resultat;
}

module.exports = { traduir, traduirNomEsdeveniment, traduirATotsIdiomes };
