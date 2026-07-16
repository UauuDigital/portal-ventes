// Crea un esdeveniment de prova per poder provar el flux de compra en local.
// Ús: npm run seed
require('dotenv').config();
const Evento = require('../models/Evento');

const dataEsdeveniment = new Date();
dataEsdeveniment.setDate(dataEsdeveniment.getDate() + 30);

const dataLimit = new Date();
dataLimit.setDate(dataLimit.getDate() + 25);

(async () => {
  const evento = await Evento.create({
    nombre: 'Sopar Espai Econòmic — edició de prova',
    fecha: dataEsdeveniment.toISOString(),
    descripcion: "Trobada mensual d'Espai Econòmic. Networking, ponència i sopar.",
    precio: 3500, // 35,00 € en cèntims
    aforo_total: 60,
    fecha_limite_compra: dataLimit.toISOString(),
    estado: 'abierto',
  });

  console.log('Esdeveniment de prova creat:');
  console.log(evento);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
