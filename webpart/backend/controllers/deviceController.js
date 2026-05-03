const { Op, fn, col, where: seqWhere } = require('sequelize');
const { Device, DeviceAction } = require('../models');
const { publishDeviceControl } = require('../services/mqttService');

/**
 * Xây dựng mảng conditions Sequelize cho exactDate linh hoạt.
 * parsed = { year?, month?, day?, hour?, minute?, second? }
 *
 * Trả về mảng conditions[] để ghép vào Op.and — tránh conflict với các filter khác.
 * Dùng tên cột đầy đủ (qualified) để tránh lỗi "ambiguous column" khi có JOIN.
 *
 * @param {object} parsed       - object các thành phần thời gian
 * @param {string} qualifiedCol - tên cột đầy đủ, ví dụ 'DeviceAction.date'
 */
function buildExactDateConditions(parsed, qualifiedCol) {
    if (!parsed || Object.keys(parsed).length === 0) return [];

    const { year, month, day, hour, minute, second } = parsed;
    const bareField = qualifiedCol.split('.').pop(); // tên field ngắn cho range query

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

        return [{ [bareField]: { [Op.between]: [start, end] } }];
    }

    // Không có year → dùng MySQL date functions với qualified column
    const conditions = [];
    if (month  !== undefined) conditions.push(seqWhere(fn('MONTH',  col(qualifiedCol)), month));
    if (day    !== undefined) conditions.push(seqWhere(fn('DAY',    col(qualifiedCol)), day));
    if (hour   !== undefined) conditions.push(seqWhere(fn('HOUR',   col(qualifiedCol)), hour));
    if (minute !== undefined) conditions.push(seqWhere(fn('MINUTE', col(qualifiedCol)), minute));
    if (second !== undefined) conditions.push(seqWhere(fn('SECOND', col(qualifiedCol)), second));

    return conditions;
}

// GET /api/device/status
// Chỉ lấy action có Status='success' gần nhất — truth source thực sự của hardware
const getStatus = async (req, res, next) => {
    try {
        const devices = await Device.findAll();
        const status = {};

        for (const device of devices) {
            const latest = await DeviceAction.findOne({
                where: {
                    IDdev:  device.IDdev,
                    Status: 'success',
                },
                order: [['date', 'DESC']],
            });
            status[device.nameDev] = latest ? (latest.running === 1) : false;
        }

        res.json(status);
    } catch (err) {
        next(err);
    }
};

// GET /api/device-actions
// Query params: page, limit, deviceName, exactDate (JSON string), keyword (legacy)
const getHistory = async (req, res, next) => {
    try {
        const page       = parseInt(req.query.page)  || 1;
        const limit      = parseInt(req.query.limit) || 10;
        const offset     = (page - 1) * limit;
        const keyword    = req.query.keyword    || '';
        const deviceName = req.query.deviceName || '';

        // Tập hợp tất cả conditions vào 1 mảng Op.and để tránh overwrite
        const andConditions = [];

        // Exact datetime filter (linh hoạt)
        if (req.query.exactDate) {
            try {
                const parsed = JSON.parse(req.query.exactDate);
                // 'DeviceAction.date' — qualified để tránh ambiguous khi JOIN với Device
                const conds = buildExactDateConditions(parsed, 'DeviceAction.date');
                andConditions.push(...conds);
            } catch (e) {
                console.warn('[DeviceController] Invalid exactDate JSON:', req.query.exactDate);
            }
        }

        // Legacy fromDate/toDate (backward compat)
        if (!req.query.exactDate) {
            const fromDate = req.query.fromDate || null;
            const toDate   = req.query.toDate   || null;
            if (fromDate) andConditions.push({ date: { [Op.gte]: new Date(fromDate) } });
            if (toDate)   andConditions.push({ date: { [Op.lte]: new Date(toDate) } });
        }

        // Keyword filter (on/off/fail/#ID) — thêm trực tiếp vào andConditions
        if (keyword) {
            if (keyword.startsWith('#')) {
                const idSearch = keyword.substring(1);
                andConditions.push({ IDactionData: { [Op.like]: `%${idSearch}%` } });
            } else {
                const kLower = keyword.toLowerCase().trim();
                if (kLower === 'on') {
                    andConditions.push({ Action: 'ON', Status: 'success' });
                } else if (kLower === 'off') {
                    andConditions.push({ Action: 'OFF', Status: 'success' });
                } else if (kLower === 'fail' || kLower === 'failed') {
                    andConditions.push({ Status: 'failed' });
                } else {
                    andConditions.push({
                        [Op.or]: [
                            { Action: { [Op.like]: `%${keyword}%` } },
                            { Status: { [Op.like]: `%${keyword}%` } },
                        ],
                    });
                }
            }
        }

        const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

        // Device name filter
        const deviceWhere = deviceName && deviceName !== 'all' ? { nameDev: deviceName } : undefined;

        const { count, rows } = await DeviceAction.findAndCountAll({
            where,
            include: [{
                model:      Device,
                as:         'device',
                attributes: ['nameDev'],
                where:      deviceWhere,
                required:   !!deviceWhere,
            }],
            order:  [['date', 'DESC']],
            limit,
            offset,
        });

        const data = rows.map(r => ({
            ID:      r.IDactionData,
            action:  r.Action,
            status:  r.Status ? r.Status.toLowerCase() : 'unknown',
            running: r.running,
            date:    r.date,
            device:  { name: r.device?.nameDev },
        }));

        res.json({ total: count, page, totalPages: Math.ceil(count / limit), data });
    } catch (err) {
        next(err);
    }
};

// POST /api/device/control
const control = async (req, res, next) => {
    try {
        const { device: deviceName, action } = req.body;

        if (!deviceName || !action) {
            return res.status(400).json({ error: 'device and action are required' });
        }
        if (!['ON', 'OFF'].includes(action)) {
            return res.status(400).json({ error: 'action must be ON or OFF' });
        }

        const device = await Device.findOne({ where: { nameDev: deviceName } });
        if (!device) {
            return res.status(404).json({ error: `Device "${deviceName}" not found` });
        }

        const log = await DeviceAction.create({
            IDdev:   device.IDdev,
            Action:  action,
            Status:  'pending',
            running: 0,
            date:    new Date(),
        });

        publishDeviceControl(deviceName, action);

        // Timeout 6s: nếu không nhận được ack từ hardware → mark failed + rollback UI
        setTimeout(async () => {
            try {
                const checkLog = await DeviceAction.findByPk(log.IDactionData);
                if (checkLog && checkLog.Status === 'pending') {
                    await checkLog.update({ Status: 'failed', running: 0 });
                    const { pushDeviceStatus } = require('../services/websocketService');
                    pushDeviceStatus({ device: deviceName, is_on: false, error: 'timeout' });
                    console.warn(`[DeviceControl] Timeout (6s): ${deviceName} → marked failed`);
                }
            } catch (err) {
                console.error('Timeout check error:', err);
            }
        }, 6000);

        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStatus, getHistory, control };
