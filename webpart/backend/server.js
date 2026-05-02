require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { sequelize } = require('./models');
const sensorRoutes = require('./routes/sensorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { initWebSocket } = require('./services/websocketService');
const { initMqtt } = require('./services/mqttService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Spec: /api/sensors/... and /api/device/... and /api/device-actions
app.use('/api/sensors', sensorRoutes);
app.use('/api/device', deviceRoutes);
// Import controller directly for device-actions since it's at the root API level
const deviceController = require('./controllers/deviceController');
app.get('/api/device-actions', deviceController.getHistory);
app.use(errorHandler);

async function start() {
    await sequelize.authenticate();
    console.log('Database connected');

    initWebSocket(server);
    initMqtt();

    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});

