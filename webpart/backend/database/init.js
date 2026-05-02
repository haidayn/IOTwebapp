require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const host     = process.env.DB_HOST     || 'localhost';
const port     = process.env.DB_PORT     || 3306;
const user     = process.env.DB_USER     || 'root';
const password = process.env.DB_PASSWORD || '';
const dbName   = process.env.DB_NAME     || 'iot_dashboard';

async function initDatabase() {

    console.log(' Connecting to MySQL (no database)...');
    let seqNoDB = new Sequelize('', user, password, {
        host, port, dialect: 'mysql', logging: false,
    });
    await seqNoDB.authenticate();
    console.log(' Connected to MySQL');

    await seqNoDB.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    console.log(` Database "${dbName}" created (or already exists)`);
    await seqNoDB.close();

    
    let seqDB = new Sequelize(dbName, user, password, {
        host, port, dialect: 'mysql', logging: false,
    });
    await seqDB.authenticate();

    const sqlFile = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

   
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.toUpperCase().startsWith('USE '));

    console.log(` Executing ${statements.length} SQL statements...`);
    for (const stmt of statements) {
        await seqDB.query(stmt + ';');
    }

    await seqDB.close();
    console.log(' Database initialized successfully!');
    console.log(' Tables: Device, DeviceAction, Sensor, SensorData');
    console.log(' Seed data: 3 devices, 3 sensors');
    process.exit(0);
}

initDatabase().catch(err => {
    console.error(' Database init failed:', err.message);
    process.exit(1);
});
