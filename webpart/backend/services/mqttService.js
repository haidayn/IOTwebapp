require('dotenv').config();
const mqtt = require('mqtt');
const { Sensor, SensorData, Device, DeviceAction } = require('../models');
const { pushSensorData, pushDeviceStatus } = require('./websocketService');

// ============================================================
// MQTT Topics — matching actual hardware (espCODE.cpp)
// ============================================================
const TOPIC_SENSOR         = 'iot/sensor/data';    // HW publishes: {"temp":30.8,"hum":78,"ldr":1}
const TOPIC_DEVICE_CONTROL = 'iot/device/control'; // Backend publishes: "led:1,status:on"
const TOPIC_DEVICE_STATUS  = 'iot/device/status';  // HW publishes: {"device":"led 1","action":"on","status":"success"}
                                                    //           or: {"error":"invalid action"}

// ============================================================
// Device control mapping: DB nameDev → hardware led number
// Frontend/Backend sends: "light" → hardware receives: "led:3,status:on"
// ============================================================
const DEVICE_LED_MAP = {
    fan:   1,  // LED_TEMP (GPIO14, D5)
    air:   2,  // LED_HUM  (GPIO12, D6)
    light: 3,  // LED_LDR  (GPIO13, D7)
};

// ============================================================
// Status response mapping: hardware "led N" → DB nameDev
// HW sends: {"device":"led 1",...} → we look up "fan"
// ============================================================
const HW_LED_TO_DEVICE = {
    'led 1': 'fan',
    'led 2': 'air',
    'led 3': 'light',
};

// ============================================================
// Sensor key aliases: DB nameSensor → possible hardware payload keys
// Hardware changed "light" key to "ldr" for light sensor
// ============================================================
const SENSOR_ALIASES = {
    temperature: ['temperature', 'temp'],
    humidity:    ['humidity', 'hum'],
    light:       ['light', 'lux', 'ldr'],   // hardware now sends "ldr" key
    temp:        ['temp', 'temperature'],
    hum:         ['hum', 'humidity'],
    ldr:         ['ldr', 'light'],
};

let client = null;

function initMqtt() {
    const brokerUrl = process.env.MQTT_HOST || 'mqtt://localhost';
    client = mqtt.connect(brokerUrl, {
        port:            parseInt(process.env.MQTT_PORT) || 1883,
        username:        process.env.MQTT_USERNAME || undefined,
        password:        process.env.MQTT_PASSWORD || undefined,
        reconnectPeriod: 5000,
    });

    client.on('connect', () => {
        console.log('[MQTT] Connected to broker:', brokerUrl);
        client.subscribe(TOPIC_SENSOR, (err) => {
            if (!err) console.log(`[MQTT] Subscribed to ${TOPIC_SENSOR}`);
            else console.error('[MQTT] Subscribe error (sensor):', err.message);
        });
        client.subscribe(TOPIC_DEVICE_STATUS, (err) => {
            if (!err) console.log(`[MQTT] Subscribed to ${TOPIC_DEVICE_STATUS}`);
            else console.error('[MQTT] Subscribe error (status):', err.message);
        });
    });

    client.on('message', async (topic, message) => {
        const raw = message.toString().trim();
        console.log(`[MQTT] ← [${topic}] ${raw}`);

        let payload = null;
        try {
            payload = JSON.parse(raw);
        } catch {
            console.warn(`[MQTT] Non-JSON message on ${topic}, skipping`);
            return;
        }

        try {
            if (topic === TOPIC_SENSOR) {
                await onSensorData(payload);
            } else if (topic === TOPIC_DEVICE_STATUS) {
                await onDeviceStatus(payload);
            }
        } catch (err) {
            console.error('[MQTT] Handler error:', err.message);
        }
    });

    client.on('error',     (err) => console.error('[MQTT] Error:', err.message));
    client.on('close',     ()    => console.log('[MQTT] Connection closed'));
    client.on('reconnect', ()    => console.log('[MQTT] Reconnecting...'));
    client.on('offline',   ()    => console.log('[MQTT] Client offline'));
}

// ============================================================
// Sensor data handler
// Hardware payload: {"temp":30.8,"hum":78,"ldr":1}
//   - "temp" → DB sensor "temperature"
//   - "hum"  → DB sensor "humidity"
//   - "ldr"  → DB sensor "light" (key renamed from "light" to "ldr")
// ============================================================
async function onSensorData(payload) {
    const sensors = await Sensor.findAll();
    const saved   = {};

    for (const sensor of sensors) {
        const dbName     = sensor.nameSensor?.toLowerCase();
        const payloadKey = resolvePayloadKey(payload, dbName);
        if (payloadKey === null) continue;

        const value = parseFloat(payload[payloadKey]);
        if (isNaN(value)) continue;

        await SensorData.create({
            IDsensor: sensor.IDsensor,
            value,
            createAt: new Date(),
        });
        saved[sensor.nameSensor] = value;
    }

    if (Object.keys(saved).length === 0) {
        console.warn('[MQTT] No sensor fields matched DB sensors. Payload:', payload);
        return;
    }

    saved.timestamp = new Date();
    pushSensorData(saved);
    console.log('[MQTT] Sensor data saved:', saved);
}

/**
 * Resolve which payload key corresponds to a given DB sensor name.
 * Priority: direct match → alias lookup → reverse alias lookup
 */
function resolvePayloadKey(payload, dbSensorName) {
    if (!dbSensorName) return null;

    // 1. Direct match
    if (payload[dbSensorName] !== undefined) return dbSensorName;

    // 2. Alias lookup: dbName → list of possible hw keys
    const aliases = SENSOR_ALIASES[dbSensorName] || [];
    for (const alias of aliases) {
        if (payload[alias] !== undefined) return alias;
    }

    // 3. Reverse: check if any hw key's alias list includes dbName
    for (const [hwKey, aliasList] of Object.entries(SENSOR_ALIASES)) {
        if (aliasList.includes(dbSensorName) && payload[hwKey] !== undefined) {
            return hwKey;
        }
    }

    return null;
}

// ============================================================
// Device status handler — NEW format (espCODE.cpp refactored)
//
// Success response: {"device":"led 1","action":"on","status":"success"}
//                   {"device":"all","action":"off","status":"success"}
// Error response:   {"error":"invalid action"} or {"error":"unknown device"}
//
// Mapping: "led 1" → fan, "led 2" → air, "led 3" → light
// ============================================================
async function onDeviceStatus(payload) {
    // Handle hardware error response
    if (payload.error) {
        console.error('[MQTT] Hardware reported error:', payload.error);
        // Mark the most recent pending action as failed
        await markAllPendingFailed();
        return;
    }

    const { device: hwDevice, action, status } = payload;

    if (!hwDevice || !action) {
        console.warn('[MQTT] Unexpected device status payload format:', payload);
        return;
    }

    if (status !== 'success') {
        console.warn('[MQTT] Hardware reported non-success status:', payload);
        return;
    }

    const is_on = (action === 'on');

    if (hwDevice === 'all') {
        // Broadcast: update all 3 devices
        const devices = await Device.findAll();
        for (const device of devices) {
            await applyDeviceStatus(device, is_on);
            pushDeviceStatus({ device: device.nameDev, is_on });
        }
        console.log(`[MQTT] All devices → ${action}`);
    } else {
        // Single device: "led 1", "led 2", or "led 3"
        const dbName = HW_LED_TO_DEVICE[hwDevice];
        if (!dbName) {
            console.warn(`[MQTT] Unknown hardware device key: "${hwDevice}"`);
            return;
        }

        const device = await Device.findOne({ where: { nameDev: dbName } });
        if (!device) {
            console.warn(`[MQTT] Device "${dbName}" not found in DB`);
            return;
        }

        await applyDeviceStatus(device, is_on);
        pushDeviceStatus({ device: dbName, is_on });
        console.log(`[MQTT] Device "${dbName}" (${hwDevice}) → ${action}`);
    }
}

/**
 * Update the DeviceAction record in DB.
 * If there is a pending action awaiting confirmation, mark it success/failed.
 * Otherwise update the latest record (physical button press).
 */
async function applyDeviceStatus(device, is_on) {
    const pendingLog = await DeviceAction.findOne({
        where: { IDdev: device.IDdev, Status: 'pending' },
        order: [['date', 'DESC']],
    });

    if (pendingLog) {
        await pendingLog.update({ running: is_on ? 1 : 0, Status: 'success' });
    } else {
        await DeviceAction.update(
            { running: is_on ? 1 : 0 },
            { where: { IDdev: device.IDdev }, order: [['date', 'DESC']], limit: 1 }
        );
    }
}

/**
 * When hardware reports an error, mark any pending actions as failed.
 */
async function markAllPendingFailed() {
    try {
        const devices = await Device.findAll();
        for (const device of devices) {
            const pendingLog = await DeviceAction.findOne({
                where: { IDdev: device.IDdev, Status: 'pending' },
                order: [['date', 'DESC']],
            });
            if (pendingLog) {
                await pendingLog.update({ Status: 'failed', running: 0 });
                const { pushDeviceStatus } = require('./websocketService');
                pushDeviceStatus({ device: device.nameDev, is_on: false, error: 'hardware_error' });
            }
        }
    } catch (err) {
        console.error('[MQTT] markAllPendingFailed error:', err.message);
    }
}

// ============================================================
// Publish device control command to hardware
// Format: "led:N,status:on" or "led:N,status:off"   (plain text)
// Called by deviceController.control()
// ============================================================
function publishDeviceControl(deviceName, action) {
    if (!client || !client.connected) {
        console.warn('[MQTT] Cannot publish: client not connected');
        return;
    }

    const ledNum = DEVICE_LED_MAP[deviceName?.toLowerCase()];
    if (ledNum === undefined) {
        console.error(`[MQTT] Unknown device name: "${deviceName}". Valid: ${Object.keys(DEVICE_LED_MAP).join(', ')}`);
        return;
    }

    const status  = action?.toUpperCase() === 'ON' ? 'on' : 'off';
    const message = `led:${ledNum},status:${status}`;

    client.publish(TOPIC_DEVICE_CONTROL, message, (err) => {
        if (err) console.error('[MQTT] Publish error:', err.message);
        else     console.log(`[MQTT] → [${TOPIC_DEVICE_CONTROL}] ${message}`);
    });
}

module.exports = { initMqtt, publishDeviceControl };
