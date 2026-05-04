const express = require('express');
const router  = express.Router();
const { getStats, getAvailableMonths } = require('../controllers/statisticsController');

// GET /api/statistics?year=2026&month=5&week=1&day=2026-05-01
router.get('/', getStats);

// GET /api/statistics/available-months
router.get('/available-months', getAvailableMonths);

module.exports = router;
