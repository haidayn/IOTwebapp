const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

// GET /api/device/status - current state derived from latest DeviceAction per device
router.get('/status', deviceController.getStatus);

// POST /api/device/control - user toggles a device, logs to DeviceAction, publishes MQTT
router.post('/control', deviceController.control);


module.exports = router;
