// routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// helper to create cookie
function sendTokenCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax', // use 'none' and secure:true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000,
  });
}

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, address, phone } = req.body;
    if (!name || !email || !password || !role || !address || !phone)
      return res.status(400).json({ message: 'Missing fields' });

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length)
      return res.status(400).json({ message: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, address, phone) VALUES (?,?,?,?,?,?)',
      [name, email, hash, role, address, phone]
    );

    sendTokenCookie(res, { id: result.insertId });
    res.json({ id: result.insertId, name, email, role, address, phone });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});


// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    sendTokenCookie(res, { id: user.id });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile_pic: user.profile_pic || null,
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

//  GET CURRENT USER
const jwtVerify = (token) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return reject(err);
      resolve(payload);
    });
  });

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const payload = await jwtVerify(token);
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, profile_pic FROM users WHERE id = ?',
      [payload.id]
    );

    if (!rows.length) return res.status(401).json({ message: 'User not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('ME ERROR:', err);
    res.status(401).json({ message: err.message });
  }
});


// update profile
router.patch('/update', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const payload = await jwtVerify(token);
    const { name, profile_pic } = req.body;

    // Update user info
    await pool.execute(
      'UPDATE users SET name = ?, profile_pic = ? WHERE id = ?',
      [name, profile_pic, payload.id]
    );

    // Return updated user
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, profile_pic FROM users WHERE id = ?',
      [payload.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('UPDATE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
