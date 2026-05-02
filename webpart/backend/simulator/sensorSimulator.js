require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mqtt = require('mqtt');

// Simulate hardware publishing to iot/sensor/env
// Replace this with real ESP32 later

const BROKER_URL = process.env.MQTT_HOST || 'mqtt://localhost';
const TOPIC = 'iot/sensor/env';
const INTERVAL_MS = 5000;

const client = mqtt.connect(BROKER_URL, {
    port: parseInt(process.env.MQTT_PORT) || 1883,
    username: process.env.MQTT_USERNAME || 'tranminhvu',
    password: process.env.MQTT_PASSWORD || '123456'
});

function drift(prev, min, max, step) {
    const next = prev + (Math.random() - 0.5) * step * 2;
    return Math.min(max, Math.max(min, next));
}

const state = { temperature: 25, humidity: 60, light: 500 };

client.on('connect', () => {
    console.log(`Simulator connected to MQTT broker - publishing to ${TOPIC} every ${INTERVAL_MS}ms`);

    setInterval(() => {
        state.temperature = parseFloat(drift(state.temperature, 15, 35, 1.5).toFixed(1));
        state.humidity    = parseFloat(drift(state.humidity, 30, 90, 3).toFixed(1));
        state.light       = Math.round(drift(state.light, 100, 1200, 80));

        const payload = JSON.stringify(state);
        client.publish(TOPIC, payload);

        console.log(`[${new Date().toLocaleTimeString()}] published: ${payload}`);
    }, INTERVAL_MS);
});

client.on('error', (err) => {
    console.error('Simulator MQTT error:', err.message);
    process.exit(1);
});
