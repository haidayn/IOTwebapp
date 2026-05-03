const { Sensor, SensorData } = require('../models');
const { Op, fn, col, where: seqWhere } = require('sequelize');
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

/**
 * Xây dựng mảng điều kiện Sequelize cho exactDate linh hoạt.
 * parsed = { year?, month?, day?, hour?, minute?, second? }
 *
 * Trả về mảng conditions[] để ghép vào Op.and — tránh conflict với các filter khác.
 * Dùng tên cột đầy đủ (qualified) để tránh lỗi "ambiguous column" khi có JOIN.
 *
 * @param {object} parsed   - object các thành phần thời gian
 * @param {string} dateField - tên cột DB đầy đủ, ví dụ 'SensorData.createAt'
 */
function buildExactDateConditions(parsed, qualifiedCol) {
    if (!parsed || Object.keys(parsed).length === 0) return [];

    const { year, month, day, hour, minute, second } = parsed;

    // Nếu có year → build range [start, end] theo đơn vị nhỏ nhất
    if (year) {
        const y  = year;
        const mo = month  ?? null;
        const d  = day    ?? null;
        const h  = hour   ?? null;
        const mi = minute ?? null;
        const se = second ?? null;

        let start, end;

        if (mo !== null && d !== null && h !== null && mi !== null && se !== null) {
            start = new Date(y, mo-1, d, h, mi, se);
            end   = new Date(y, mo-1, d, h, mi, se, 999);
        } else if (mo !== null && d !== null && h !== null && mi !== null) {
            start = new Date(y, mo-1, d, h, mi, 0);
            end   = new Date(y, mo-1, d, h, mi, 59, 999);
        } else if (mo !== null && d !== null && h !== null) {
            start = new Date(y, mo-1, d, h, 0, 0);
            end   = new Date(y, mo-1, d, h, 59, 59, 999);
        } else if (mo !== null && d !== null) {
            start = new Date(y, mo-1, d, 0, 0, 0);
            end   = new Date(y, mo-1, d, 23, 59, 59, 999);
        } else if (mo !== null) {
            start = new Date(y, mo-1, 1, 0, 0, 0);
            end   = new Date(y, mo, 0, 23, 59, 59, 999);
        } else {
            start = new Date(y, 0, 1, 0, 0, 0);
            end   = new Date(y, 11, 31, 23, 59, 59, 999);
        }

        // Trả về dạng mảng 1 phần tử để dễ ghép vào Op.and
        return [{ [qualifiedCol.split('.').pop()]: { [Op.between]: [start, end] } }];
    }

    // Không có year → dùng MySQL date functions
    // Dùng tên cột đầy đủ để tránh ambiguous column khi JOIN
    const conditions = [];
    if (month  !== undefined) conditions.push(seqWhere(fn('MONTH',  col(qualifiedCol)), month));
    if (day    !== undefined) conditions.push(seqWhere(fn('DAY',    col(qualifiedCol)), day));
    if (hour   !== undefined) conditions.push(seqWhere(fn('HOUR',   col(qualifiedCol)), hour));
    if (minute !== undefined) conditions.push(seqWhere(fn('MINUTE', col(qualifiedCol)), minute));
    if (second !== undefined) conditions.push(seqWhere(fn('SECOND', col(qualifiedCol)), second));

    return conditions;
}

// GET /api/sensors/history
// Query params: page, limit, sensorName, exactDate (JSON string), sortBy, sortDir
const getHistory = async (req, res, next) => {
    try {
        const page    = parseInt(req.query.page)   || 1;
        const limit   = parseInt(req.query.limit)  || 10;
        const sortBy  = req.query.sortBy  === 'date' ? 'createAt' : (req.query.sortBy || 'createAt');
        const sortDir = req.query.sortDir || 'DESC';
        const offset  = (page - 1) * limit;

        // Tập hợp tất cả conditions vào 1 mảng Op.and để tránh overwrite
        const andConditions = [];

        // Exact datetime filter (linh hoạt)
        if (req.query.exactDate) {
            try {
                const parsed = JSON.parse(req.query.exactDate);
                // 'SensorData.createAt' — qualified để tránh ambiguous khi JOIN với Sensor
                const conds = buildExactDateConditions(parsed, 'SensorData.createAt');
                andConditions.push(...conds);
            } catch (e) {
                console.warn('[SensorController] Invalid exactDate JSON:', req.query.exactDate);
            }
        }

        // Legacy: backward compat startDate/endDate
        if (!req.query.exactDate) {
            if (req.query.startDate) andConditions.push({ createAt: { [Op.gte]: new Date(req.query.startDate) } });
            if (req.query.endDate)   andConditions.push({ createAt: { [Op.lte]: new Date(req.query.endDate) } });
        }

        // Keyword filter (tìm theo giá trị số)
        if (req.query.keyword) {
            let searchVal = req.query.keyword.trim();
            if (!isNaN(searchVal) && searchVal !== '') {
                searchVal = String(Number(searchVal));
            }
            andConditions.push(
                sequelize.where(
                    sequelize.cast(sequelize.fn('ROUND', sequelize.col('SensorData.value'), 2), 'CHAR'),
                    { [Op.like]: `${searchVal}%` }
                )
            );
        }

        const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

        // Sensor name filter
        const sensorWhere = {};
        if (req.query.sensorName && req.query.sensorName !== 'all') {
            sensorWhere.nameSensor = req.query.sensorName;
        }

        const { count, rows } = await SensorData.findAndCountAll({
            where,
            include: [{
                model:      Sensor,
                as:         'sensor',
                where:      Object.keys(sensorWhere).length ? sensorWhere : undefined,
                attributes: ['nameSensor'],
            }],
            order:  [[sortBy, sortDir.toUpperCase()]],
            limit,
            offset,
        });

        const data = rows.map(r => ({
            ID:     r.IDdata,
            value:  r.value,
            date:   r.createAt,
            sensor: { name: r.sensor?.nameSensor },
        }));

        res.json({ total: count, page, totalPages: Math.ceil(count / limit), data });
    } catch (err) {
        next(err);
    }
};

module.exports = { getLatest, getHistory };
