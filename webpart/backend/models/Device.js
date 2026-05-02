const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model Device — ánh xạ với bảng `device` trong DB iot
 * Columns: IDdev (PK), nameDev, createAt
 */
const Device = sequelize.define('Device', {
    IDdev: {
        type:          DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
    },
    nameDev: {
        type:      DataTypes.STRING(30),
        allowNull: true,
    },
    createAt: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName:  'device',
    timestamps: false,
});

module.exports = Device;
