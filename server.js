require('dotenv').config();

const path = require('path');
const express = require('express');

const webhookRoutes = require('./routes/webhookRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { requireAuthPage, teSessioValida } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// El webhook de Stripe necessita el body en brut per verificar la signatura,
// per això es registra ABANS del parser JSON global.
app.use(webhookRoutes);

app.use(express.json());
app.use(adminRoutes);

// La pàgina de login queda fora de protecció: es registra abans del
// middleware requireAuthPage, així Express la serveix sense demanar sessió.
// Si ja hi ha una sessió vàlida (p. ex. l'admin hi arriba des de l'enllaç
// discret de la pàgina principal sense haver tancat sessió abans), es
// redirigeix directament al panell en lloc de tornar a demanar contrasenya.
app.get('/admin/login.html', (req, res) => {
  if (teSessioValida(req)) return res.redirect('/admin/index.html');
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});
app.use('/admin', requireAuthPage, express.static(path.join(__dirname, 'public', 'admin')));

app.use(express.static(path.join(__dirname, 'public')));

app.use(publicRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Gestor d'errors genèric
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'error_intern' });
});

app.listen(PORT, () => {
  console.log(`Portal Espai Econòmic escoltant a http://localhost:${PORT}`);
});

module.exports = app;
