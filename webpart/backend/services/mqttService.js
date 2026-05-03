require('dotenv').config();
const mqtt = require('mqtt');
const { Op } = require('sequelize');
const { Sensor, SensorData, Device, DeviceAction } = require('../models');
const { pushSensorData, pushDeviceStatus } = require('./websocketService');

// ============================================================
// MQTT Topics — matching hardware (espCODE.cpp)
// ============================================================
const TOPIC_SENSOR         = 'iot/sensor/data';    // HW publishes: {"temp":30.8,"hum":78,"ldr":1}
const TOPIC_DEVICE_CONTROL = 'iot/device/control'; // Backend publishes: {"led":1,"status":"on"}
const TOPIC_DEVICE_STATUS  = 'iot/device/status';  // HW publishes: {"device":"led 1","action":"on","status":"success"}
const TOPIC_DEVICE_SYNC    = 'iot/device/sync';    // [NEW] Bidirectional sync channel

// ============================================================
// Device control mapping: DB nameDev → hardware led number
// ============================================================
const DEVICE_LED_MAP = {
    fan:   1,  // LED_TEMP (GPIO14, D5)
    air:   2,  // LED_HUM  (GPIO12, D6)
    light: 3,  // LED_LDR  (GPIO13, D7)
};

// ============================================================
// Status response mapping: hardware "led N" → DB nameDev
// ============================================================
const HW_LED_TO_DEVICE = {
    'led 1': 'fan',
    'led 2': 'air',
    'led 3': 'light',
};

// ============================================================
// Sensor key aliases: DB nameSensor → possible hardware payload keys
// ============================================================
const SENSOR_ALIASES = {
    temperature: ['temperature', 'temp'],
    humidity:    ['humidity', 'hum'],
    light:       ['light', 'lux', 'ldr'],
    temp:        ['temp', 'temperature'],
    hum:         ['hum', 'humidity'],
    ldr:         ['ldr', 'light'],
};

let client = null;

// ============================================================
// MQTT Init
// ============================================================
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
            else      console.error('[MQTT] Subscribe error (sensor):', err.message);
        });
        client.subscribe(TOPIC_DEVICE_STATUS, (err) => {
            if (!err) console.log(`[MQTT] Subscribed to ${TOPIC_DEVICE_STATUS}`);
            else      console.error('[MQTT] Subscribe error (status):', err.message);
        });
        client.subscribe(TOPIC_DEVICE_SYNC, (err) => {
            if (!err) console.log(`[MQTT] Subscribed to ${TOPIC_DEVICE_SYNC}`);
            else      console.error('[MQTT] Subscribe error (sync):', err.message);
        });

        // [NEW] Sau 3 giây kết nối, tự push toàn bộ trạng thái xuống hardware
        // (phòng trường hợp backend restart khi ESP đang online)
        setTimeout(() => {
            publishFullState('backend-init');
        }, 3000);
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
            } else if (topic === TOPIC_DEVICE_SYNC) {
                await onSyncRequest(payload);
            }
        } catch (err) {
            console.error('[MQTT] Handler error:', err.message);
        }
    });

    client.on('error',     (err) => console.error('[MQTT] Error:', err.message));
    client.on('close',     ()    => console.log('[MQTT] Connection closed'));
    client.on('reconnect', ()    => console.log('[MQTT] Reconnecting...'));
    client.on('offline',   ()    => console.log('[MQTT] Client offline'));

    // [NEW] Pending timeout guard — chạy mỗi 15 giây
    // Nếu lệnh vẫn còn "pending" sau 30 giây → mark failed và retry
    setInterval(pendingTimeoutGuard, 15000);
}

// ============================================================
// [NEW] Sync request handler
// ESP gửi: {"request":"sync"} → Backend đọc DB → push trạng thái đầy đủ
// Backend cũng lắng nghe xác nhận: {"sync":"applied"} — chỉ log, không xử lý thêm
// ============================================================
async function onSyncRequest(payload) {
    // Bỏ qua payload xác nhận từ ESP
    if (payload?.sync === 'applied') {
        console.log('[SYNC] Hardware confirmed sync applied.');
        return;
    }

    if (payload?.request !== 'sync') {
        console.warn('[SYNC] Unknown sync payload:', payload);
        return;
    }

    console.log('[SYNC] Hardware requested state sync. Reading DB...');
    await publishFullState('hw-request');
}

// ============================================================
// [NEW] Đọc trạng thái hiện tại từ DB và push xuống hardware
// Payload gửi xuống: {"fan":1,"air":0,"light":1}  (1=ON, 0=OFF)
// source: chuỗi mô tả ai gọi, chỉ dùng cho log
// ============================================================
async function publishFullState(source = 'manual') {
    if (!client || !client.connected) {
        console.warn('[SYNC] Cannot push state: MQTT client not connected');
        return;
    }

    try {
        const devices = await Device.findAll();
        const state = {};

        for (const device of devices) {
            // Chỉ lấy action 'success' gần nhất — đồng nhất với getStatus trong deviceController
            const lastAction = await DeviceAction.findOne({
                where: {
                    IDdev:  device.IDdev,
                    Status: 'success',
                },
                order: [['date', 'DESC']],
            });
            // running: 1 = đang bật, 0 = đang tắt
            state[device.nameDev] = lastAction?.running ?? 0;
        }

        const msg = JSON.stringify(state);
        client.publish(TOPIC_DEVICE_SYNC, msg, (err) => {
            if (err) console.error('[SYNC] Publish error:', err.message);
            else     console.log(`[SYNC] (${source}) Full state pushed → hardware:`, state);
        });
    } catch (err) {
        console.error('[SYNC] publishFullState error:', err.message);
    }
}

// ============================================================
// [NEW] Pending timeout guard
// Kiểm tra các DeviceAction có Status='pending' quá 30 giây
// → mark 'failed', retry bằng cách publish lại lệnh xuống hardware
// ============================================================
async function pendingTimeoutGuard() {
    try {
        const threshold = new Date(Date.now() - 15000); // 15 giây trước (update-note §2)
        const stuckActions = await DeviceAction.findAll({
            where: {
                Status: 'pending',
                date:   { [Op.lt]: threshold },
            },
        });

        if (stuckActions.length === 0) return;

        console.warn(`[GUARD] Found ${stuckActions.length} stuck pending action(s). Retrying...`);

        for (const action of stuckActions) {
            await action.update({ Status: 'failed' });

            const device = await Device.findByPk(action.IDdev);
            if (!device) continue;

            console.warn(`[GUARD] Retrying: ${device.nameDev} → ${action.Action}`);
            publishDeviceControl(device.nameDev, action.Action);

            // Thông báo lên WebSocket để UI biết đang retry
            pushDeviceStatus({
                device: device.nameDev,
                is_on:  action.Action?.toUpperCase() === 'ON',
                retrying: true,
            });
        }
    } catch (err) {
        console.error('[GUARD] pendingTimeoutGuard error:', err.message);
    }
}

// ============================================================
// Sensor data handler
// Hardware payload: {"temp":30.8,"hum":78,"ldr":1}
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

    if (payload[dbSensorName] !== undefined) return dbSensorName;

    const aliases = SENSOR_ALIASES[dbSensorName] || [];
    for (const alias of aliases) {
        if (payload[alias] !== undefined) return alias;
    }

    for (const [hwKey, aliasList] of Object.entries(SENSOR_ALIASES)) {
        if (aliasList.includes(dbSensorName) && payload[hwKey] !== undefined) {
            return hwKey;
        }
    }

    return null;
}

// ============================================================
// Device status handler
// Success: {"device":"led 1","action":"on","status":"success"}
// Error:   {"error":"invalid action"}
// Sync ack:{"sync":"applied"}  ← handled in onSyncRequest
// ============================================================
async function onDeviceStatus(payload) {
    if (payload.error) {
        console.error('[MQTT] Hardware reported error:', payload.error);
        await markAllPendingFailed();
        return;
    }

    const { device: hwDevice, action, status } = payload;

    if (!hwDevice || !action) {
        console.warn('[MQTT] Unexpected device status payload:', payload);
        return;
    }

    if (status !== 'success') {
        console.warn('[MQTT] Hardware reported non-success status:', payload);
        return;
    }

    const is_on = (action === 'on');

    if (hwDevice === 'all') {
        const devices = await Device.findAll();
        for (const device of devices) {
            await applyDeviceStatus(device, is_on);
            pushDeviceStatus({ device: device.nameDev, is_on });
        }
        console.log(`[MQTT] All devices → ${action}`);
    } else {
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
 * Update the DeviceAction record in DB after hardware confirms.
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
                pushDeviceStatus({ device: device.nameDev, is_on: false, error: 'hardware_error' });
            }
        }
    } catch (err) {
        console.error('[MQTT] markAllPendingFailed error:', err.message);
    }
}

// ============================================================
// Publish device control command to hardware
// Format JSON: {"led":1,"status":"on"}
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
    const message = JSON.stringify({ led: ledNum, status });

    client.publish(TOPIC_DEVICE_CONTROL, message, (err) => {
        if (err) console.error('[MQTT] Publish error:', err.message);
        else     console.log(`[MQTT] → [${TOPIC_DEVICE_CONTROL}] ${message}`);
    });
}

module.exports = { initMqtt, publishDeviceControl, publishFullState };
