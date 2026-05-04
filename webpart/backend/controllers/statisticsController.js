const { Op, fn, col, literal } = require('sequelize');
const { Device, DeviceAction } = require('../models');

// ============================================================
// Helpers
// ============================================================

/**
 * Trả về khoảng thời gian [start, end] dựa trên các bộ lọc.
 * @param {number|null} year
 * @param {number|null} month   - 1-indexed
 * @param {number|null} week    - tuần của tháng (1-4)
 * @param {string|null} day     - 'YYYY-MM-DD'
 */
function buildDateRange(year, month, week, day) {
    const now = new Date();
    const y = year  || now.getFullYear();
    const m = month || (now.getMonth() + 1); // 1-indexed

    // Nếu chọn ngày cụ thể (day = 'YYYY-MM-DD')
    if (day) {
        const d = new Date(day);
        if (isNaN(d.getTime())) return null;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        return { start, end };
    }

    // Nếu chọn tuần trong tháng
    if (week) {
        const wk = parseInt(week);
        // Tuần 1: ngày 1-7, tuần 2: 8-14, tuần 3: 15-21, tuần 4: 22-cuối tháng
        const startDay = (wk - 1) * 7 + 1;
        const endDay   = wk < 4
            ? wk * 7
            : new Date(y, m, 0).getDate(); // ngày cuối tháng
        const start = new Date(y, m - 1, startDay, 0, 0, 0);
        const end   = new Date(y, m - 1, endDay, 23, 59, 59, 999);
        return { start, end };
    }

    // Chỉ chọn tháng
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end   = new Date(y, m, 0, 23, 59, 59, 999);  // ngày 0 của tháng m+1 = ngày cuối tháng m
    return { start, end };
}

// ============================================================
// API: GET /api/statistics
// Query params: year, month, week, day
// Response: [{ device, total, on, off }, ...]
// Chỉ tính Status = 'success'
// ============================================================
const getStats = async (req, res, next) => {
    try {
        const { year, month, week, day } = req.query;

        const range = buildDateRange(
            year  ? parseInt(year)  : null,
            month ? parseInt(month) : null,
            week  ? parseInt(week)  : null,
            day   || null
        );

        if (!range) {
            return res.status(400).json({ error: 'Invalid date parameters' });
        }

        const { start, end } = range;

        // Lấy tất cả devices
        const devices = await Device.findAll({ order: [['IDdev', 'ASC']] });
        const result  = [];

        for (const device of devices) {
            // Chỉ đếm Status = 'success'
            const actions = await DeviceAction.findAll({
                where: {
                    IDdev:  device.IDdev,
                    Status: 'success',
                    date:   { [Op.between]: [start, end] },
                },
                attributes: ['Action'],
            });

            const onCount  = actions.filter(a => a.Action?.toUpperCase() === 'ON').length;
            const offCount = actions.filter(a => a.Action?.toUpperCase() === 'OFF').length;

            result.push({
                device: device.nameDev,
                total:  onCount + offCount,
                on:     onCount,
                off:    offCount,
            });
        }

        res.json({
            range: { start, end },
            data:  result,
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// API: GET /api/statistics/available-months
// Trả về danh sách các tháng có dữ liệu (Status='success')
// Response: [{ year, month }, ...]  sắp xếp mới nhất trước
// ============================================================
const getAvailableMonths = async (req, res, next) => {
    try {
        const rows = await DeviceAction.findAll({
            where:      { Status: 'success' },
            attributes: [
                [fn('YEAR',  col('date')), 'year'],
                [fn('MONTH', col('date')), 'month'],
            ],
            group:   [fn('YEAR', col('date')), fn('MONTH', col('date'))],
            order:   [[literal('year DESC, month DESC')]],
            raw:     true,
        });

        res.json(rows.map(r => ({ year: r.year, month: r.month })));
    } catch (err) {
        next(err);
    }
};

module.exports = { getStats, getAvailableMonths };
