// Script de diagnòstic per confirmar per què el procés no arrenca en
// producció (Phusion Passenger no arrenca l'app). Només fa require() dels
// mòduls implicats — mai toca la BD real ni Stripe real ni crida
// db.aplicarSchema() — perquè es pugui executar de forma segura des del
// panell "Executar Script" de Plesk (npm run diag) sense cap efecte
// secundari, ni tan sols si l'entorn (.env de producció) està mal
// configurat.
//
// Ús: node scripts/diag.js  (o  npm run diag)
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ARREL = path.join(__dirname, '..');

function separador(titol) {
  console.log('');
  console.log('='.repeat(60));
  console.log(titol);
  console.log('='.repeat(60));
}

separador('1. VERSIÓ DE NODE');
console.log(process.version);

separador('2-3. DEPENDÈNCIES DECLARADES A package.json');
const pkg = require('../package.json');
const dependencies = pkg.dependencies || {};
const nomsDependencies = Object.keys(dependencies);
if (nomsDependencies.length === 0) {
  console.log('(package.json no declara cap dependència.)');
}
nomsDependencies.forEach((nom) => {
  const versioDeclarada = dependencies[nom];
  const carpetaNodeModules = path.join(ARREL, 'node_modules', nom);
  const existeixCarpeta = fs.existsSync(carpetaNodeModules);

  let errorResolucio = null;
  try {
    require.resolve(nom);
  } catch (err) {
    errorResolucio = err;
  }

  const estat = errorResolucio ? 'FALLA' : 'OK';
  console.log(`[${estat}] ${nom} (declarada: ${versioDeclarada}) — carpeta a node_modules: ${existeixCarpeta ? 'sí' : 'NO'}`);
  if (errorResolucio) {
    console.log(`   require.resolve('${nom}') ha fallat: ${errorResolucio.message}`);
  }
});

separador('4. config/db.js (només require — sense aplicarSchema, sense tocar la BD)');
try {
  require('../config/db');
  console.log('[OK] config/db.js s\'ha carregat sense excepció.');
} catch (err) {
  console.log('[FALLA] config/db.js ha llançat una excepció en carregar-se:');
  console.log(err.stack || err.message);
}

separador('5. FITXERS PROPIS DE LES ÚLTIMES TANDES (només require)');
// Inclou els explícitament demanats (stripeController, pdfAsistentes) i la
// resta de fitxers tocats en les tandes recents que qualsevol ruta acaba
// carregant transitivament en arrencar el servidor (adminController és el
// candidat més probable: és el que fa require('../utils/csv'), un fitxer
// que una tanda recent ha eliminat).
const fitxersAComprovar = [
  'controllers/stripeController.js',
  'controllers/adminController.js',
  'models/Compra.js',
  'models/Evento.js',
  'utils/pdfAsistentes.js',
  'utils/checkoutConfig.js',
  'utils/validarAcompanyants.js',
  'utils/mailer.js',
  'routes/adminRoutes.js',
  'routes/publicRoutes.js',
  'routes/webhookRoutes.js',
];
// NOTA: server.js NO es comprova aquí — fer-ne require() arrencaria de
// veritat el procés (app.listen + db.aplicarSchema contra la BD real),
// exactament el que aquest script ha d'evitar.

fitxersAComprovar.forEach((relatiu) => {
  const rutaAbsoluta = path.join(ARREL, relatiu);
  if (!fs.existsSync(rutaAbsoluta)) {
    console.log(`[NO EXISTEIX] ${relatiu}`);
    return;
  }
  try {
    require(rutaAbsoluta);
    console.log(`[OK] ${relatiu}`);
  } catch (err) {
    console.log(`[FALLA] ${relatiu}`);
    console.log(err.stack || err.message);
  }
});

separador('DIAGNÒSTIC ACABAT');
