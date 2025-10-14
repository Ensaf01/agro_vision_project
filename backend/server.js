// server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const marketplaceRoutes = require('./routes/marketplace');
const requestsRoutes = require('./routes/requests');
const cropsRoutes = require('./routes/crops');


const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true
  }
});

// Attach io to app for access in routes
app.set('io', io);

io.on('connection', (socket) => {
  // Join farmer room for notifications
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });
});

// Middleware
app.use(express.json({ limit: '10mb' })); // allow larger JSON for base64 images later if needed
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
// serve generated PDFs under /receipts
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/marketplace', marketplaceRoutes); // main marketplace routes
app.use('/api/requests', requestsRoutes);
app.use("/api/crops-marketplace", require("./routes/cropsMarketplace")); // avoid conflict


app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running correctly 🚀' });
});

// Catch-all error handler for unknown routes (always returns JSON)
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on ${PORT}`));
