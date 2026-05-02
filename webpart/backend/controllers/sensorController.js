const { Sensor, SensorData } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// GET /api/sensors/latest
const getLatest = async (req, res, next) => {
    try {
        const sensors = await Sensor.findAll();
        const result = {};

        for (const sensor of sensors) {
            const latest = await SensorData.findOne({
                where: { IDsensor: sensor.IDsensor },
                order: [['createAt', 'DESC']],
            });
            result[sensor.nameSensor] = latest ? latest.value : null;
        }

        result.timestamp = new Date();
        res.json(result);
    } catch (err) {
        next(err);
    }
};

// GET /api/sensors/history
// Query params: page, limit, sensorName, startDate, endDate, sortBy, sortDir, keyword
const getHistory = async (req, res, next) => {
    try {
        const page    = parseInt(req.query.page)   || 1;
        const limit   = parseInt(req.query.limit)  || 10;
        const sortBy  = req.query.sortBy  === 'date' ? 'createAt' : (req.query.sortBy || 'createAt');
        const sortDir = req.query.sortDir || 'DESC';
        const offset  = (page - 1) * limit;

        const where = {};

        // Datetime filter (chuẩn hóa từ ISO string)
        if (req.query.startDate) where.createAt = { [Op.gte]: new Date(req.query.startDate) };
        if (req.query.endDate)   where.createAt = { ...where.createAt, [Op.lte]: new Date(req.query.endDate) };

        // Keyword filter (tìm theo giá trị số)
        if (req.query.keyword) {
            let searchVal = req.query.keyword.trim();
            if (!isNaN(searchVal) && searchVal !== '') {
                searchVal = String(Number(searchVal));
            }
            where[Op.and] = [
                sequelize.where(
                    sequelize.cast(sequelize.fn('ROUND', sequelize.col('SensorData.value'), 2), 'CHAR'),
                    { [Op.like]: `${searchVal}%` }
                )
            ];
        }

        // Sensor name filter
        const sensorWhere = {};
        if (req.query.sensorName && req.query.sensorName !== 'all') {
            sensorWhere.nameSensor = req.query.sensorName;
        }

        const { count, rows } = await SensorData.findAndCountAll({
            where,
            include: [{ model: Sensor, as: 'sensor', where: Object.keys(sensorWhere).length ? sensorWhere : undefined, attributes: ['nameSensor'] }],
            order:  [[sortBy, sortDir.toUpperCase()]],
            limit,
            offset,
        });

        // Normalize output để frontend dùng trường "name" và "date"
        const data = rows.map(r => ({
            ID:    r.IDdata,
            value: r.value,
            date:  r.createAt,
            sensor: { name: r.sensor?.nameSensor },
        }));

        res.json({ total: count, page, totalPages: Math.ceil(count / limit), data });
    } catch (err) {
        next(err);
    }
};

module.exports = { getLatest, getHistory };
