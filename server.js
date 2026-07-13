require('dotenv').config();

const path = require('path');
const express = require('express');

const webhookRoutes = require('./routes/webhookRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// El webhook de Stripe necessita el body en brut per verificar la signatura,
// per això es registra ABANS del parser JSON global.
app.use(webhookRoutes);

app.use(express.json());
app.use(adminRoutes);
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
