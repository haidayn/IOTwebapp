const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model DeviceAction — ánh xạ với bảng `device_action` trong DB iot
 * Columns: IDactionData (PK), IDdev (FK→device), Action, Status, running, date
 */
const DeviceAction = sequelize.define('DeviceAction', {
    IDactionData: {
        type:          DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
    },
    IDdev: {
        type:      DataTypes.INTEGER,
        allowNull: true,
    },
    Action: {
        type:      DataTypes.STRING(45),
        allowNull: true,
    },
    Status: {
        type:      DataTypes.STRING(45),
        allowNull: true,
    },
    running: {
        type:         DataTypes.INTEGER,
        allowNull:    true,
        defaultValue: 0,
        comment:      '1 = đang chạy, 0 = đã dừng',
    },
    date: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName:  'device_action',
    timestamps: false,
});

module.exports = DeviceAction;
