require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'iot_dashboard',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host:    process.env.DB_HOST || 'localhost',
        port:    parseInt(process.env.DB_PORT) || 3306,
        dialect: 'mysql',
        logging: false, 
        pool: {
            max:     10,
            min:     0,
            acquire: 30000,
            idle:    10000,
        },
        define: {
            timestamps:  false, 
            underscored: false,
        },
        timezone: '+07:00', 
    }
);

module.exports = sequelize;
