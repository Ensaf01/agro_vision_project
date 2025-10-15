//routes/requests.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

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

// Get dealer request details by requestId
router.get('/:requestId', verifyUser, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const [rows] = await pool.execute(
      `SELECT r.*, u.name as dealer_name, u.email as dealer_email, u.phone as dealer_phone, u.address as dealer_address, c.name as crop_name, f.name as farmer_name, f.email as farmer_email, f.phone as farmer_phone, f.address as farmer_address
       FROM requests r
       JOIN users u ON r.dealer_id = u.id
       JOIN crops c ON r.crop_id = c.id
       JOIN users f ON r.farmer_id = f.id
       WHERE r.id = ?`,
      [requestId]
    );
    if (!rows || rows.length === 0) {
      console.error('Dealer request not found for requestId:', requestId);
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch dealer details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept dealer request, send notification, and generate PDF
router.post('/accept/:requestId', verifyUser, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    // Update request status
    await pool.execute('UPDATE requests SET status = ? WHERE id = ?', ['accepted', requestId]);

    // Get request details for PDF and notification
    const [[request]] = await pool.execute(
      `SELECT r.*, u.name as dealer_name, u.id as dealer_id, c.name as crop_name, f.name as farmer_name
       FROM requests r
       JOIN users u ON r.dealer_id = u.id
       JOIN crops c ON r.crop_id = c.id
       JOIN users f ON r.farmer_id = f.id
       WHERE r.id = ?`,
      [requestId]
    );

    // Send congratulation notification to dealer
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, request_id, read_flag) VALUES (?, 'deal', 'Congratulations!', 'Your request for buying has been accepted. Download your deal PDF.', ?, 0)`,
      [request.dealer_id, requestId]
    );

    // Generate PDF (simulate, should be replaced with actual PDF generation)
    // For now, just return a static URL
    const pdfUrl = `/receipts/receipt_request_${requestId}_${Date.now()}.pdf`;
 

    res.json({ message: 'Request accepted', pdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject dealer request
router.post('/reject/:requestId', verifyUser, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    await pool.execute('UPDATE requests SET status = ? WHERE id = ?', ['rejected', requestId]);
    // Optionally notify dealer of rejection
    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

//  Dealer: create a request 
router.post('/create', verifyUser, async (req, res) => {
  try {
    const dealerId = req.user.id;
    const { crop_id, requested_quantity, bid_price, dealer_phone, dealer_address } = req.body;

    // Get crop
    const [cropRows] = await pool.execute(
      'SELECT id, farmer_id, name, unit FROM crops WHERE id = ?',
      [crop_id]
    );
    if (!cropRows.length) return res.status(404).json({ message: 'Crop not found' });
    const crop = cropRows[0];

    // Get dealer name
    const [dealerRows] = await pool.execute('SELECT id, name FROM users WHERE id = ?', [dealerId]);
    if (!dealerRows.length) return res.status(400).json({ message: 'Dealer not found' });
    const dealerName = dealerRows[0].name || 'Dealer';

    // Insert request
    const [result] = await pool.execute(
      `INSERT INTO requests
        (crop_id, farmer_id, dealer_id, dealer_name, dealer_phone, dealer_address, requested_quantity, unit, bid_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crop_id,
        crop.farmer_id,
        dealerId,
        dealerName,
        dealer_phone || null,
        dealer_address || null,
        requested_quantity,
        crop.unit || 'kg',
        bid_price
      ]
    );

    // Update highest bid
    await pool.execute(
      `UPDATE crops SET highest_bid = GREATEST(COALESCE(highest_bid, 0), ?) WHERE id = ?`,
      [bid_price, crop_id]
    );

    const requestId = result.insertId;

    // Create notification
    const title = 'New purchase request';
    const message = `${dealerName} requested ${requested_quantity} ${crop.unit} of ${crop.name} at ${bid_price} Tk`;

    const [notifResult] = await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, request_id)
       VALUES (?, 'dealer_request', ?, ?, ?)`,
      [crop.farmer_id, title, message, requestId]
    );

    const notificationId = notifResult.insertId;

    // Emit notification via Socket.IO
    const io = req.app.get('io');
    io.to(`farmer_${crop.farmer_id}`).emit('newRequest', {
      id: notificationId,
      type: 'dealer_request',
      title,
      message,
      request_id: requestId,
      crop_name: crop.name,
      requested_quantity,
      unit: crop.unit,
      bid_price,
      read_flag: 0,
      created_at: new Date()
    });

    res.json({ message: 'Request created and farmer notified', requestId });
  } catch (err) {
    console.error('CREATE REQUEST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//  Get notifications for a user
router.get('/notifications/:userId', verifyUser, async (req, res) => {
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

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as unreadCount 
       FROM notifications 
       WHERE user_id = ? AND read_flag = 0`,
      [userId]
    );

    res.json({ notifications: rows, unreadCount: countRows[0].unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read 
router.post('/notifications/read/:notificationId', verifyUser, async (req, res) => {
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
