require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const videoRoutes = require('./routes/videoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.resolve(__dirname, '../storage/uploads');
const RENDER_DIR = path.resolve(__dirname, '../storage/renders');
[UPLOAD_DIR, RENDER_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', videoRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use((err, req, res, next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`CuteForge server running on port ${PORT}`);
});

module.exports = app;
