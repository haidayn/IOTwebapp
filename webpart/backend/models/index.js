const sequelize  = require('../config/database');
const Device       = require('./Device');
const DeviceAction = require('./DeviceAction');
const Sensor       = require('./Sensor');
const SensorData   = require('./SensorData');

// ============================================================
// Associations — ánh xạ theo đúng tên FK trong DB iot
// ============================================================

// sensor → sensor_data  (IDsensor)
Sensor.hasMany(SensorData, { foreignKey: 'IDsensor', as: 'data' });
SensorData.belongsTo(Sensor, { foreignKey: 'IDsensor', as: 'sensor' });

// device → device_action  (IDdev)
Device.hasMany(DeviceAction, { foreignKey: 'IDdev', as: 'actions' });
DeviceAction.belongsTo(Device, { foreignKey: 'IDdev', as: 'device' });

module.exports = { sequelize, Device, DeviceAction, Sensor, SensorData };
