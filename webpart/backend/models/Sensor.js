const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model Sensor — ánh xạ với bảng `sensor` trong DB iot
 * Columns: IDsensor (PK), nameSensor, createAt
 */
const Sensor = sequelize.define('Sensor', {
    IDsensor: {
        type:          DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
    },
    nameSensor: {
        type:      DataTypes.STRING(30),
        allowNull: true,
    },
    createAt: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName:  'sensor',
    timestamps: false,
});

module.exports = Sensor;
