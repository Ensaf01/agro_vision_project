// routes/crops.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
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

//  Add a crop 
router.post('/add', verifyUser, async (req, res) => {
  try {
    const { name, land_size, cultivate_date, harvest_date, total_cost, crop_pic } = req.body;
    if (!name || !land_size || !cultivate_date || !harvest_date || !total_cost) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      'INSERT INTO crops (farmer_id, name, land_size, cultivate_date, harvest_date, total_cost, crop_pic) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, land_size, cultivate_date, harvest_date, total_cost, crop_pic || null]
    );

    res.json({ message: 'Crop added successfully', crop_id: result.insertId });
  } catch (err) {
    console.error('Add crop error:', err);
    res.status(500).json({ message: 'Server error' });
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
      'SELECT * FROM crops WHERE farmer_id = ? ORDER BY created_at DESC',
      [farmerId]
    );
    res.json(crops);
  } catch (err) {
    console.error('Get farmer crops error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// FARMER: Update crop 
router.patch('/:cropId', verifyUser, async (req, res) => {
  try {
    const { cropId } = req.params;
    const { total_cost } = req.body;

    // Validate total_cost
    if (total_cost === undefined) {
      return res.status(400).json({ message: 'total_cost is required' });
    }

    const costNumber = parseFloat(total_cost);
    if (isNaN(costNumber) || costNumber < 0) {
      return res.status(400).json({ message: 'total_cost must be a non-negative number' });
    }

    // Check if crop exists and belongs to the farmer
    const [rows] = await pool.execute('SELECT * FROM crops WHERE id = ?', [cropId]);
    if (!rows.length) return res.status(404).json({ message: 'Crop not found' });
    if (rows[0].farmer_id !== req.user.id) return res.status(403).json({ message: 'Forbidden: Not your crop' });

    // Update total_cost only
    await pool.execute(
      'UPDATE crops SET total_cost = ? WHERE id = ? AND farmer_id = ?',
      [costNumber, cropId, req.user.id]
    );

    res.json({ message: 'Crop cost updated successfully' });
  } catch (err) {
    console.error('Update crop error:', err);
    res.status(500).json({ message: 'Server error while updating crop' });
  }
});


// FARMER: Delete crop 
router.delete('/:cropId', verifyUser, async (req, res) => {
  try {
    const { cropId } = req.params;

    const [rows] = await pool.execute('SELECT * FROM crops WHERE id = ?', [cropId]);
    if (!rows.length) return res.status(404).json({ message: 'Crop not found' });
    if (rows[0].farmer_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    // Optional: delete related requests/bids/marketplace entries if needed
    await pool.execute('DELETE FROM crops WHERE id = ?', [cropId]);
    res.json({ message: 'Crop deleted successfully' });
  } catch (err) {
    console.error('Delete crop error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//GET ALL CROPS (with highest bid)
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
      return { ...c, bids: requests };
    }));

    res.json(cropsWithRequests);
  } catch (err) {
    console.error('Get all crops error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//  DEALER: Place a bid
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

    await pool.execute(
      'INSERT INTO bids (crop_id, dealer_id, bid_price) VALUES (?, ?, ?)',
      [cropId, req.user.id, bid_price]
    );

    res.json({ message: 'Bid placed successfully' });
  } catch (err) {
    console.error('Place bid error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DEALER: Request a crop 
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

    res.json({ message: 'Request sent successfully', request_id: result.insertId });
  } catch (err) {
    console.error('Request crop error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
