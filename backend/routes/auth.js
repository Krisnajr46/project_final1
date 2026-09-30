const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// contoh: pakai array sebagai DB sementara
const users = [];

// SIGNUP
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const existing = users.find(u => u.email === email);
  if (existing) return res.status(400).json({ message: 'User sudah ada' });

  const hash = await bcrypt.hash(password, 10);
  const newUser = { id: users.length + 1, email, password: hash };
  users.push(newUser);

  res.json({ message: 'Signup berhasil' });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'User tidak ditemukan' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: 'Password salah' });

  const token = jwt.sign({ id: user.id, email: user.email }, 'SECRET_KEY', { expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
