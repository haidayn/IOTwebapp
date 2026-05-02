require('dotenv').config();
const mqtt = require('mqtt');
const { Sensor, SensorData, Device, DeviceAction } = require('../models');
const { pushSensorData, pushDeviceStatus } = require('./websocketService');

// MQTT topics defined in spec
const TOPIC_SENSOR = 'iot/sensor/env';
const TOPIC_DEVICE_CONTROL = 'iot/device/control';
const TOPIC_DEVICE_STATUS = 'iot/device/status';

let client = null;

function initMqtt() {
    const brokerUrl = `${process.env.MQTT_HOST || 'mqtt://localhost'}`;
    client = mqtt.connect(brokerUrl, {
        port:     parseInt(process.env.MQTT_PORT) || 3636,
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        reconnectPeriod: 5000,
    });

    client.on('connect', () => {
        console.log('MQTT connected to broker');
        client.subscribe(TOPIC_SENSOR, (err) => {
            if (!err) console.log(`Subscribed to ${TOPIC_SENSOR}`);
        });
        client.subscribe(TOPIC_DEVICE_STATUS, (err) => {
            if (!err) console.log(`Subscribed to ${TOPIC_DEVICE_STATUS}`);
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());

            if (topic === TOPIC_SENSOR) {
                await onSensorData(payload);
            } else if (topic === TOPIC_DEVICE_STATUS) {
                await onDeviceStatus(payload);
            }
        } catch (err) {
            console.error('MQTT message error:', err.message);
        }
    });

    client.on('error', (err) => console.error('MQTT error:', err.message));
}

// Save sensor reading to DB, then push to FE via WebSocket
// Expected payload: { temperature: 25.5, humidity: 60, light: 500 }
async function onSensorData(payload) {
    const sensors = await Sensor.findAll();
    const saved = {};

    for (const sensor of sensors) {
        const value = payload[sensor.nameSensor];
        if (value === undefined) continue;

        await SensorData.create({ IDsensor: sensor.IDsensor, value, createAt: new Date() });
        saved[sensor.nameSensor] = value;
    }

    saved.timestamp = new Date();
    pushSensorData(saved);
}

// Update DeviceAction running field, push device status to FE
// Expected payload: { device: 'fan', is_on: true }
async function onDeviceStatus(payload) {
    const { device: deviceName, is_on } = payload;
    if (!deviceName) return;

    const device = await Device.findOne({ where: { nameDev: deviceName } });
    if (!device) return;

    // Tìm record đang chờ xác nhận từ thiết bị
    const pendingLog = await DeviceAction.findOne({
        where: { IDdev: device.IDdev, Status: 'pending' },
        order: [['date', 'DESC']]
    });

    if (pendingLog) {
        await pendingLog.update({ running: is_on ? 1 : 0, Status: 'success' });
    } else {
        // Cập nhật trạng thái mới nhất do ấn nút cứng ở mạch thực tế
        await DeviceAction.update(
            { running: is_on ? 1 : 0 },
            { where: { IDdev: device.IDdev }, order: [['date', 'DESC']], limit: 1 }
        );
    }

    pushDeviceStatus({ device: deviceName, is_on });
}

// Publish device control command to hardware
// Called by deviceController.control()
function publishDeviceControl(deviceName, action) {
    if (!client || !client.connected) return;
    client.publish(TOPIC_DEVICE_CONTROL, JSON.stringify({ device: deviceName, action }));
}

module.exports = { initMqtt, publishDeviceControl };
