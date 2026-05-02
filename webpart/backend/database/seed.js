require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize, Device, DeviceAction, Sensor, SensorData } = require('../models');

async function seedDatabase() {
    console.log(' Seeding database...');
    await sequelize.authenticate();

    // ── Devices ──────────────────────────────────────────────
    const [fan] = await Device.findOrCreate({
        where: { ID: 1 },
        defaults: { name: 'fan', createAt: new Date() },
    });
    const [ac] = await Device.findOrCreate({
        where: { ID: 2 },
        defaults: { name: 'airConditioner', createAt: new Date() },
    });
    const [light] = await Device.findOrCreate({
        where: { ID: 3 },
        defaults: { name: 'light', createAt: new Date() },
    });
    console.log(' Devices seeded: fan, airConditioner, light');

    // ── Sensors ──────────────────────────────────────────────
    const [tempSensor] = await Sensor.findOrCreate({
        where: { ID: 1 },
        defaults: { name: 'temperature', createAt: new Date() },
    });
    const [humSensor] = await Sensor.findOrCreate({
        where: { ID: 2 },
        defaults: { name: 'humidity', createAt: new Date() },
    });
    const [lightSensor] = await Sensor.findOrCreate({
        where: { ID: 3 },
        defaults: { name: 'light', createAt: new Date() },
    });
    console.log('Sensors seeded: temperature, humidity, light');

    // ── SensorData mẫu (10 bản ghi mỗi cảm biến) ────────────
    const now = new Date();
    const sensorSeedData = [];
    for (let i = 10; i >= 1; i--) {
        const d = new Date(now - i * 5000); // mỗi 5 giây
        sensorSeedData.push(
            { SensorID: 1, value: (22 + Math.random() * 8).toFixed(2),   date: d }, // temp
            { SensorID: 2, value: (50 + Math.random() * 30).toFixed(2),  date: d }, // humidity
            { SensorID: 3, value: Math.round(200 + Math.random() * 800), date: d }, // light
        );
    }
    await SensorData.bulkCreate(sensorSeedData, { ignoreDuplicates: true });
    console.log(` SensorData seeded: ${sensorSeedData.length} records`);

    // ── DeviceAction mẫu ─────────────────────────────────────
    const actionSeedData = [
        { deviceID: 1, action: 'ON',  status: 'success', running: 1, date: new Date(now - 300000), createAt: new Date(now - 300000) },
        { deviceID: 1, action: 'OFF', status: 'success', running: 0, date: new Date(now - 200000), createAt: new Date(now - 200000) },
        { deviceID: 2, action: 'ON',  status: 'success', running: 1, date: new Date(now - 150000), createAt: new Date(now - 150000) },
        { deviceID: 3, action: 'ON',  status: 'success', running: 1, date: new Date(now - 100000), createAt: new Date(now - 100000) },
        { deviceID: 3, action: 'OFF', status: 'success', running: 0, date: new Date(now - 50000),  createAt: new Date(now - 50000)  },
    ];
    await DeviceAction.bulkCreate(actionSeedData);
    console.log(` DeviceActions seeded: ${actionSeedData.length} records`);

    console.log('\n Seeding completed successfully!');
    process.exit(0);
}

seedDatabase().catch(err => {
    console.error(' Seeding failed:', err.message);
    process.exit(1);
});
