// routes/marketplace.js
const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Middleware to verify user
const verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// FARMER: Add crop 
router.post('/add', verifyUser, async (req, res) => {
  try {
    const { name, quantity, unit, base_price, crop_pic, land_size, cultivate_date, harvest_date, total_cost } = req.body;

    if (!name || (!quantity && !land_size)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      `INSERT INTO crops 
       (farmer_id, name, quantity, unit, base_price, crop_pic, land_size, cultivate_date, harvest_date, total_cost) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        quantity || null,
        unit || null,
        base_price || null,
        crop_pic || null,
        land_size || null,
        cultivate_date || null,
        harvest_date || null,
        total_cost || null
      ]
    );

    res.json({ message: 'Crop added successfully', crop_id: result.insertId });
  } catch (err) {
    console.error('Add crop error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//FARMER: Direct add crop to marketplace
router.post('/add-direct', verifyUser, async (req, res) => {
  try {
    const { name, quantity, unit, price, crop_pic, discount, minQuantity } = req.body;

    if (!name || !quantity || !unit || !price) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Insert into crops table
    const [cropResult] = await pool.execute(
      `INSERT INTO crops (farmer_id, name, quantity, unit, base_price, crop_pic) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, quantity, unit, price, crop_pic || null]
    );

    const cropId = cropResult.insertId;

    // Insert into marketplace directly
    const [marketResult] = await pool.execute(
      `INSERT INTO marketplace 
       (crop_id, crop_name, farmer_id, quantity, price, crop_pic, discount, min_quantity) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cropId, name, req.user.id, quantity, price, crop_pic || null, discount || null, minQuantity || null]
    );

    res.json({
      message: 'Crop added directly to marketplace!',
      cropId,
      marketplaceId: marketResult.insertId
    });
  } catch (err) {
    console.error('Add-direct error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//FARMER: Update crop 
router.patch('/:cropId', verifyUser, async (req, res) => {
  try {
    const { cropId } = req.params;
    const { name, quantity, unit, base_price, total_cost } = req.body;

    const [rows] = await pool.execute('SELECT * FROM crops WHERE id = ?', [cropId]);
    if (!rows.length) return res.status(404).json({ message: 'Crop not found' });
    if (rows[0].farmer_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    await pool.execute(
      `UPDATE crops 
       SET name = COALESCE(?, name), 
           quantity = COALESCE(?, quantity), 
           unit = COALESCE(?, unit), 
           base_price = COALESCE(?, base_price), 
           total_cost = COALESCE(?, total_cost) 
       WHERE id = ?`,
      [name, quantity, unit, base_price, total_cost, cropId]
    );

    res.json({ message: 'Crop updated successfully' });
  } catch (err) {
    console.error('Update crop error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE crop from marketplace
router.delete('/:cropTd', async (req, res) => {
  try {
    const cropId = req.params.id;

    //  delete crop from database
    const [rows] = await db.query('DELETE FROM marketplace WHERE id = ?', [cropId]);

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: 'Crop not found or already deleted' });
    }

    res.json({ message: 'Crop deleted successfully' });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: 'Failed to delete crop' });
  }
});


// Get crops for this farmer 
router.get('/farmer/:farmerId', verifyUser, async (req, res) => {
  try {
    const { farmerId } = req.params;
    if (parseInt(farmerId) !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Not your crops' });
    }

    const [crops] = await pool.execute(
  'SELECT * FROM crops WHERE farmer_id = ? AND harvested = 0 ORDER BY created_at DESC',
  [farmerId]
);

    res.json(crops);
  } catch (err) {
    console.error('Get farmer crops error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Get all marketplace crops for logged-in farmer
router.get('/my-crops', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM marketplace WHERE farmer_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get my marketplace crops error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// GET ALL CROPS WITH BIDS 
router.get('/', verifyUser, async (req, res) => {
  try {
    const [crops] = await pool.execute(
      `SELECT c.*, u.name as farmer_name,
              (SELECT MAX(bid_price) FROM requests WHERE crop_id = c.id) as highest_bid
       FROM crops c
       JOIN users u ON u.id = c.farmer_id
       ORDER BY c.created_at DESC`
    );

    const cropsWithRequests = await Promise.all(crops.map(async c => {
      const [requests] = await pool.execute(
        `SELECT r.*, u.name as dealer_name 
         FROM requests r 
         JOIN users u ON u.id = r.dealer_id
         WHERE r.crop_id = ?`,
        [c.id]
      );
      return { ...c, requests };
    }));

    res.json(cropsWithRequests);
  } catch (err) {
    console.error('Get all crops error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all crops in marketplace (for everyone to see)
router.get("/crops", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.id, m.crop_name, m.quantity, m.price, m.crop_pic,
              m.min_quantity, m.discount,
              u.name as farmer_name, m.farmer_id
       FROM marketplace m
       JOIN users u ON m.farmer_id = u.id`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching marketplace crops:", err);
    res.status(500).json({ message: "Server error fetching marketplace crops" });
  }
});


// Harvest / Add to Marketplace
router.post('/harvest/:cropId', verifyUser, async (req, res) => {
  try {
    const { price, quantity, discount, minQuantity } = req.body;

    if (!price || !quantity) {
      return res.status(400).json({ message: 'Quantity and price are required' });
    }

    const quantityNum = parseFloat(quantity);
    const priceNum = parseFloat(price);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive number' });
    }
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number' });
    }

    const [cropRows] = await pool.execute('SELECT * FROM crops WHERE id = ? AND farmer_id = ?', [req.params.cropId, req.user.id]);
    if (!cropRows.length) return res.status(404).json({ message: 'Crop not found or unauthorized' });

    const crop = cropRows[0];

    const [result] = await pool.execute(
      `INSERT INTO marketplace 
       (crop_id, crop_name, farmer_id, quantity, price, crop_pic, discount, min_quantity) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crop.id, crop.name, req.user.id, quantityNum, priceNum, crop.crop_pic, discount || null, minQuantity || null]
    );
await pool.execute('UPDATE crops SET harvested = 1 WHERE id = ?', [crop.id]);
    res.json({
      message: 'Crop added to marketplace',
      marketplace_id: result.insertId,
      crop_id: crop.id,
      crop_name: crop.name,
      farmer_id: req.user.id,
      quantity: quantityNum,
      price: priceNum,
      crop_pic: crop.crop_pic
    });
  } catch (err) {
    console.error('Harvest error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// Place bid 
router.post('/bid/:cropId', verifyUser, async (req, res) => {
  try {
    const { cropId } = req.params;
    const { bid_price } = req.body;

    const [cropRows] = await pool.execute('SELECT base_price FROM crops WHERE id = ?', [cropId]);
    if (!cropRows.length) return res.status(404).json({ message: 'Crop not found' });

    const base_price = cropRows[0].base_price;
    const min_bid = base_price - 5;
    const max_bid = base_price + 5;

    if (bid_price < min_bid || bid_price > max_bid)
      return res.status(400).json({ message: `Bid must be between ${min_bid} and ${max_bid}` });

    await pool.execute('INSERT INTO bids (crop_id, dealer_id, bid_price) VALUES (?, ?, ?)', [cropId, req.user.id, bid_price]);

    res.json({ message: 'Bid placed successfully' });
  } catch (err) {
    console.error('Place bid error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DEALER: Request crop 
router.post('/request/:cropId', verifyUser, async (req, res) => {
  try {
    const { cropId } = req.params;
    const { requested_quantity, bid_price, dealer_phone, dealer_address, unit } = req.body;

    const [cropRows] = await pool.execute('SELECT * FROM crops WHERE id = ?', [cropId]);
    if (!cropRows.length) return res.status(404).json({ message: 'Crop not found' });
    const crop = cropRows[0];

    const [result] = await pool.execute(
      `INSERT INTO requests 
       (crop_id, farmer_id, dealer_id, dealer_phone, dealer_address, requested_quantity, unit, bid_price, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cropId, crop.farmer_id, req.user.id, dealer_phone, dealer_address, requested_quantity, unit, bid_price, 'pending']
    );

    const requestId = result.insertId;
    const [dealerRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const dealerName = dealerRows.length ? dealerRows[0].name : 'Dealer';

    const title = 'New purchase request';
    const message = `${dealerName} requested ${requested_quantity} ${unit} of ${crop.name} at ${bid_price} Tk`;

    const [notifResult] = await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, request_id, read_flag) VALUES (?, 'dealer_request', ?, ?, ?, 0)`,
      [crop.farmer_id, title, message, requestId]
    );

    const notificationId = notifResult.insertId;
    const io = req.app.get('io');
    if (io) {
      io.to(`farmer_${crop.farmer_id}`).emit('newRequest', {
        id: notificationId,
        type: 'dealer_request',
        title,
        message,
        request_id: requestId,
        crop_name: crop.name,
        requested_quantity,
        unit,
        bid_price,
        read_flag: 0,
        created_at: new Date()
      });
    }

    res.json({ message: 'Request sent successfully', request_id: requestId });
  } catch (err) {
    console.error('Request crop error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
