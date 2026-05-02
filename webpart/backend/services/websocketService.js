const { WebSocketServer } = require('ws');

let wss = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        ws.on('close', () => console.log('WebSocket client disconnected'));
    });

    console.log('WebSocket server initialized');
}

// Push sensor data to all connected FE clients
// Called by mqttService after saving to DB
function pushSensorData(data) {
    if (!wss) return;
    const msg = JSON.stringify({ type: 'sensor', payload: data });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(msg);
    });
}

// Push device status update to all connected FE clients
function pushDeviceStatus(data) {
    if (!wss) return;
    const msg = JSON.stringify({ type: 'device', payload: data });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(msg);
    });
}

module.exports = { initWebSocket, pushSensorData, pushDeviceStatus };
