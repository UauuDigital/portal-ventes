const express = require('express');
const router = express.Router();

const { login, logout } = require('../controllers/authController');

router.post('/admin/login', login);
router.post('/admin/logout', logout);

module.exports = router;
