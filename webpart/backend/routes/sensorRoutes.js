const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// GET /api/sensors/latest
router.get('/latest', sensorController.getLatest);

// GET /api/sensors/history
router.get('/history', sensorController.getHistory);

module.exports = router;
