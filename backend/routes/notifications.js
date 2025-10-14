//routes/notifications.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Middleware to verify token
const verifyUser = (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all notifications for a user
router.get('/:userId', verifyUser, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (req.user.id !== userId) return res.status(403).json({ message: 'Forbidden' });

    const [rows] = await pool.execute(
      `SELECT n.*, r.crop_id, r.requested_quantity, r.unit, r.bid_price,
              u.name AS dealer_name, c.name AS crop_name
       FROM notifications n
       LEFT JOIN requests r ON n.request_id = r.id
       LEFT JOIN users u ON r.dealer_id = u.id
       LEFT JOIN crops c ON r.crop_id = c.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark a notification as read
router.post('/read/:notificationId', verifyUser, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.notificationId);
    await pool.execute(`UPDATE notifications SET read_flag = 1 WHERE id = ?`, [notificationId]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
