const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model SensorData — ánh xạ với bảng `sensor_data` trong DB iot
 * Columns: IDdata (PK), IDsensor (FK→sensor), value, createAt
 */
const SensorData = sequelize.define('SensorData', {
    IDdata: {
        type:          DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
    },
    IDsensor: {
        type:      DataTypes.INTEGER,
        allowNull: true,
    },
    value: {
        type:      DataTypes.DOUBLE,
        allowNull: true,
    },
    createAt: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName:  'sensor_data',
    timestamps: false,
});

module.exports = SensorData;
