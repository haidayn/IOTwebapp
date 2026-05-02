const { Op } = require('sequelize');
const { Device, DeviceAction } = require('../models');
const { publishDeviceControl } = require('../services/mqttService');

// GET /api/device/status
const getStatus = async (req, res, next) => {
    try {
        const devices = await Device.findAll();
        const status = {};

        for (const device of devices) {
            const latest = await DeviceAction.findOne({
                where: { IDdev: device.IDdev },
                order: [['date', 'DESC']],
            });
            // Normalize: dùng nameDev làm key, Action để xác định trạng thái
            if (latest) status[device.nameDev] = latest.Action === 'ON';
            else        status[device.nameDev] = false;
        }

        res.json(status);
    } catch (err) {
        next(err);
    }
};

// GET /api/device-actions
const getHistory = async (req, res, next) => {
    try {
        const page     = parseInt(req.query.page)  || 1;
        const limit    = parseInt(req.query.limit) || 10;
        const offset   = (page - 1) * limit;
        const keyword    = req.query.keyword   || '';
        const deviceName = req.query.deviceName || '';
        const fromDate   = req.query.fromDate  || null;
        const toDate     = req.query.toDate    || null;

        const where = {};

        // Datetime filter
        if (fromDate || toDate) {
            where.date = {};
            if (fromDate) where.date[Op.gte] = new Date(fromDate);
            if (toDate)   where.date[Op.lte] = new Date(toDate);
        }

        // Keyword filter (on/off/fail/#ID)
        if (keyword) {
            if (keyword.startsWith('#')) {
                const idSearch = keyword.substring(1);
                where.IDactionData = { [Op.like]: `%${idSearch}%` };
            } else {
                const kLower = keyword.toLowerCase().trim();
                if (kLower === 'on') {
                    where.Action = 'ON'; where.Status = 'success';
                } else if (kLower === 'off') {
                    where.Action = 'OFF'; where.Status = 'success';
                } else if (kLower === 'fail' || kLower === 'failed') {
                    where.Status = 'failed';
                } else {
                    where[Op.or] = [
                        { Action: { [Op.like]: `%${keyword}%` } },
                        { Status: { [Op.like]: `%${keyword}%` } },
                    ];
                }
            }
        }

        // Device name filter
        const deviceWhere = deviceName ? { nameDev: deviceName } : undefined;

        const { count, rows } = await DeviceAction.findAndCountAll({
            where,
            include: [{ model: Device, as: 'device', attributes: ['nameDev'], where: deviceWhere }],
            order:  [['date', 'DESC']],
            limit,
            offset,
        });

        // Normalize output
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
            running: action === 'ON' ? 1 : 0,
            date:    new Date(),
        });

        publishDeviceControl(deviceName, action);

        // Timeout 10s (req §5.6): nếu không nhận được status response từ Hardware → đánh dấu failed + rollback
        setTimeout(async () => {
            try {
                const checkLog = await DeviceAction.findByPk(log.IDactionData);
                if (checkLog && checkLog.Status === 'pending') {
                    await checkLog.update({ Status: 'failed', running: 0 });
                    const { pushDeviceStatus } = require('../services/websocketService');
                    pushDeviceStatus({ device: deviceName, is_on: false, error: 'timeout' });
                }
            } catch (err) {
                console.error('Timeout check error:', err);
            }
        }, 10000);

        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
};

module.exports = { getStatus, getHistory, control };
