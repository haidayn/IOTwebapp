const { Op, fn, col, where: seqWhere } = require('sequelize'); // Import các toán tử và hàm của Sequelize để thao tác với CSDL
const { Device, DeviceAction } = require('../models'); // Import model Device và DeviceAction (đại diện cho bảng thiết bị và lịch sử điều khiển)
const { publishDeviceControl } = require('../services/mqttService'); // Import hàm từ mqttService để gửi lệnh xuống phần cứng

/**
 * Với Sequelize timezone:'+07:00', mọi Date object bị cộng thêm +7h trước khi
 * gửi sang MySQL. DB lưu giờ local (16:14:53 ICT). Fix: truyền Date có UTC = (giờ local - 7h)
 * để Sequelize cộng +7h thành đúng giờ local đang lưu trong DB.
 */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function makeLocalDate(y, mo, d, h, mi, se, ms = 0) {
    return new Date(Date.UTC(y, mo - 1, d, h, mi, se, ms) - TZ_OFFSET_MS);
}

/**
 * Xây dựng mảng conditions Sequelize cho exactDate linh hoạt.
 * parsed = { year?, month?, day?, hour?, minute?, second? }
 */
function buildExactDateConditions(parsed, qualifiedCol) {
    if (!parsed || Object.keys(parsed).length === 0) return [];

    const { year, month, day, hour, minute, second } = parsed;
    const bareField = qualifiedCol.split('.').pop();

    // TRƯỜNG HỢP 1: CÓ NĂM → tạo khoảng [start, end] khớp với giờ local trong DB
    if (year) {
        const y  = year;
        const mo = month  ?? null;
        const d  = day    ?? null;
        const h  = hour   ?? null;
        const mi = minute ?? null;
        const se = second ?? null;

        let start, end;

        if (mo !== null && d !== null && h !== null && mi !== null && se !== null) {
            start = makeLocalDate(y, mo, d, h, mi, se, 0);
            end   = makeLocalDate(y, mo, d, h, mi, se, 999);
        } else if (mo !== null && d !== null && h !== null && mi !== null) {
            start = makeLocalDate(y, mo, d, h, mi, 0, 0);
            end   = makeLocalDate(y, mo, d, h, mi, 59, 999);
        } else if (mo !== null && d !== null && h !== null) {
            start = makeLocalDate(y, mo, d, h, 0, 0, 0);
            end   = makeLocalDate(y, mo, d, h, 59, 59, 999);
        } else if (mo !== null && d !== null) {
            start = makeLocalDate(y, mo, d, 0, 0, 0, 0);
            end   = makeLocalDate(y, mo, d, 23, 59, 59, 999);
        } else if (mo !== null) {
            const lastDay = new Date(y, mo, 0).getDate();
            start = makeLocalDate(y, mo, 1,       0,  0,  0, 0);
            end   = makeLocalDate(y, mo, lastDay, 23, 59, 59, 999);
        } else {
            start = makeLocalDate(y, 1,  1,  0,  0,  0, 0);
            end   = makeLocalDate(y, 12, 31, 23, 59, 59, 999);
        }

        return [{ [bareField]: { [Op.between]: [start, end] } }];
    }

    // TRƯỜNG HỢP 2: KHÔNG CÓ NĂM → so sánh từng thành phần
    // DB lưu giờ local nên HOUR(col) trả về đúng giờ local, không cần CONVERT_TZ
    const conditions = [];
    if (month  !== undefined) conditions.push(seqWhere(fn('MONTH',  col(qualifiedCol)), month));
    if (day    !== undefined) conditions.push(seqWhere(fn('DAY',    col(qualifiedCol)), day));
    if (hour   !== undefined) conditions.push(seqWhere(fn('HOUR',   col(qualifiedCol)), hour));
    if (minute !== undefined) conditions.push(seqWhere(fn('MINUTE', col(qualifiedCol)), minute));
    if (second !== undefined) conditions.push(seqWhere(fn('SECOND', col(qualifiedCol)), second));

    return conditions;
}

// ============================================================================
// API: GET /api/device/status
// Lấy trạng thái ON/OFF hiện tại của tất cả các thiết bị.
// ============================================================================
const getStatus = async (req, res, next) => {
    try {
        // Lấy danh sách tất cả các thiết bị từ cơ sở dữ liệu
        const devices = await Device.findAll();
        const status = {}; // Khởi tạo object để map tên thiết bị -> trạng thái (true/false)

        for (const device of devices) {
            // Với mỗi thiết bị, tìm bản ghi điều khiển gần nhất CÓ TRẠNG THÁI 'success'
            // Việc lấy 'success' đảm bảo đây là trạng thái thực sự do phần cứng xác nhận (truth source),
            // bỏ qua các lệnh bị 'failed' hoặc đang 'pending' chưa rõ kết quả.
            const latest = await DeviceAction.findOne({
                where: {
                    IDdev:  device.IDdev,
                    Status: 'success', // Điều kiện cốt lõi của tính năng đồng bộ
                },
                order: [['date', 'DESC']], // Sắp xếp giảm dần theo thời gian để lấy cái mới nhất
            });
            // Nếu có dữ liệu, gán true nếu running == 1, ngược lại false (mặc định false nếu không có data)
            status[device.nameDev] = latest ? (latest.running === 1) : false;
        }

        // Trả về JSON cho Frontend
        res.json(status);
    } catch (err) {
        next(err); // Đẩy lỗi cho Error Handler của Express
    }
};

// ============================================================================
// API: GET /api/device-actions
// Lấy danh sách lịch sử điều khiển thiết bị (có hỗ trợ lọc và phân trang).
// ============================================================================
const getHistory = async (req, res, next) => {
    try {
        // Xử lý các tham số phân trang
        const page       = parseInt(req.query.page)  || 1; // Trang hiện tại (mặc định 1)
        const limit      = parseInt(req.query.limit) || 10; // Số bản ghi mỗi trang (mặc định 10)
        const offset     = (page - 1) * limit; // Tính toán vị trí bỏ qua (dùng cho SQL LIMIT/OFFSET)
        
        // Nhận tham số tìm kiếm
        const keyword    = req.query.keyword    || '';
        const deviceName = req.query.deviceName || '';

        // Khởi tạo mảng chứa TẤT CẢ các điều kiện (để gộp chung bằng Op.and, tránh xung đột)
        const andConditions = [];

        // 1. Xử lý bộ lọc ExactDate (định dạng ngày tháng linh hoạt truyền từ frontend dạng JSON)
        if (req.query.exactDate) {
            try {
                const parsed = JSON.parse(req.query.exactDate); // Parse JSON chuỗi ngày
                // Gọi hàm buildExactDateConditions, dùng tên cột đầy đủ 'DeviceAction.date'
                const conds = buildExactDateConditions(parsed, 'DeviceAction.date');
                andConditions.push(...conds); // Thêm các điều kiện trả về vào mảng chung
            } catch (e) {
                console.warn('[DeviceController] Invalid exactDate JSON:', req.query.exactDate);
            }
        }

        // 2. Tương thích ngược (Backward compatibility) cho các request dùng fromDate/toDate cũ
        if (!req.query.exactDate) {
            const fromDate = req.query.fromDate || null;
            const toDate   = req.query.toDate   || null;
            if (fromDate) andConditions.push({ date: { [Op.gte]: new Date(fromDate) } }); // Lớn hơn hoặc bằng
            if (toDate)   andConditions.push({ date: { [Op.lte]: new Date(toDate) } });   // Nhỏ hơn hoặc bằng
        }

        // 3. Xử lý bộ lọc Từ khóa (Keyword filter)
        if (keyword) {
            if (keyword.startsWith('#')) {
                // Nếu bắt đầu bằng # -> Ưu tiên tìm kiếm chính xác theo ID bản ghi
                const idSearch = keyword.substring(1);
                andConditions.push({ IDactionData: { [Op.like]: `%${idSearch}%` } });
            } else {
                // Tìm kiếm tổng quát theo chữ
                const kLower = keyword.toLowerCase().trim();
                if (kLower === 'on') {
                    andConditions.push({ Action: 'ON', Status: 'success' });
                } else if (kLower === 'off') {
                    andConditions.push({ Action: 'OFF', Status: 'success' });
                } else if (kLower === 'fail' || kLower === 'failed') {
                    andConditions.push({ Status: 'failed' });
                } else {
                    // Cú pháp OR cho phép tìm text trong cột Action HOẶC cột Status
                    andConditions.push({
                        [Op.or]: [
                            { Action: { [Op.like]: `%${keyword}%` } },
                            { Status: { [Op.like]: `%${keyword}%` } },
                        ],
                    });
                }
            }
        }

        // 4. Lọc theo Action (ON / OFF) — dropdown từ frontend
        if (req.query.actionFilter && req.query.actionFilter !== 'all') {
            andConditions.push({ Action: req.query.actionFilter.toUpperCase() });
        }

        // 5. Lọc theo Running (1 = đang bật, 0 = đã tắt) — dropdown từ frontend
        if (req.query.runningFilter !== undefined && req.query.runningFilter !== 'all') {
            andConditions.push({ running: parseInt(req.query.runningFilter) });
        }

        // Tổng hợp where clause từ mảng andConditions, nếu mảng rỗng thì where là object rỗng
        const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

        // 4. Xử lý bộ lọc theo tên thiết bị riêng biệt
        // Nếu chọn một thiết bị cụ thể (!== 'all'), tạo điều kiện lọc bên bảng Device
        const deviceWhere = deviceName && deviceName !== 'all' ? { nameDev: deviceName } : undefined;

        // Truy vấn CSDL bằng Sequelize, kết hợp đếm tổng số bản ghi (findAndCountAll)
        const { count, rows } = await DeviceAction.findAndCountAll({
            where, // Gắn điều kiện đã tổng hợp ở trên
            include: [{
                model:      Device,     // JOIN với bảng Device
                as:         'device',   // Dùng alias 'device'
                attributes: ['nameDev'], // Chỉ lấy cột nameDev cho nhẹ
                where:      deviceWhere,// Gắn điều kiện lọc tên thiết bị
                required:   !!deviceWhere, // Nếu có lọc thì INNER JOIN (bắt buộc khớp), nếu không thì LEFT JOIN
            }],
            order:  [['date', 'DESC']], // Sắp xếp mới nhất lên đầu
            limit,   // Cắt số lượng hiển thị
            offset,  // Bỏ qua các bản ghi trang trước
        });

        // 5. Chuẩn hóa dữ liệu đầu ra (Normalize output) cho khớp với model phía Frontend
        const data = rows.map(r => ({
            ID:      r.IDactionData,
            action:  r.Action,
            status:  r.Status ? r.Status.toLowerCase() : 'unknown',
            running: r.running,
            date:    r.date,
            device:  { name: r.device?.nameDev }, // Lấy tên device từ bảng đã JOIN
        }));

        // Trả về tổng số lượng, trang hiện tại, tổng số trang, và tập dữ liệu
        res.json({ total: count, page, totalPages: Math.ceil(count / limit), data });
    } catch (err) {
        next(err); // Đẩy lỗi cho Error Handler
    }
};

// ============================================================================
// API: POST /api/device/control
// Tiếp nhận yêu cầu điều khiển bật/tắt thiết bị từ Frontend và gửi xuống phần cứng.
// ============================================================================
const control = async (req, res, next) => {
    try {
        const { device: deviceName, action } = req.body; // Lấy dữ liệu từ Payload request

        // Validate cơ bản
        if (!deviceName || !action) {
            return res.status(400).json({ error: 'device and action are required' });
        }
        if (!['ON', 'OFF'].includes(action)) {
            return res.status(400).json({ error: 'action must be ON or OFF' });
        }

        // Kiểm tra thiết bị có tồn tại trong CSDL hay không
        const device = await Device.findOne({ where: { nameDev: deviceName } });
        if (!device) {
            return res.status(404).json({ error: `Device "${deviceName}" not found` });
        }

        // TẠO BẢN GHI LOG PENDING: Lưu dấu vết thao tác người dùng trước khi gửi lệnh thực sự
        const log = await DeviceAction.create({
            IDdev:   device.IDdev,
            Action:  action,
            Status:  'pending', // Lệnh đang chờ phần cứng xác nhận
            running: 0,         // Giá trị mặc định, chỉ thay đổi sau khi phần cứng phản hồi 'success'
            date:    new Date(),
        });

        // Gửi lệnh qua MQTT Broker tới phần cứng thông qua dịch vụ mqttService
        publishDeviceControl(deviceName, action);

        // THIẾT LẬP TIMEOUT BẢO VỆ (Timeout Rollback Guard):
        // Chờ tối đa 6 giây (6000ms). Nếu phần cứng không gửi tín hiệu xác nhận phản hồi về lại (qua mqttService),
        // API sẽ tự động xử lý lỗi này ngầm bên dưới.
        setTimeout(async () => {
            try {
                // Lấy lại bản ghi log từ DB để xem trạng thái đã được update bởi mqttService chưa
                const checkLog = await DeviceAction.findByPk(log.IDactionData);
                // Nếu vẫn kẹt ở trạng thái 'pending' -> Thiết bị rớt mạng / Không hồi đáp
                if (checkLog && checkLog.Status === 'pending') {
                    // Sửa bản ghi trong DB thành failed để chốt sổ lịch sử
                    await checkLog.update({ Status: 'failed', running: 0 });
                    
                    // Phát (emit) 1 tin nhắn qua WebSocket báo cho Frontend biết lệnh đã timeout
                    // Frontend sẽ bắt sự kiện này và gạt công tắc (toggle) trở lại vị trí ban đầu (Rollback UI)
                    const { pushDeviceStatus } = require('../services/websocketService');
                    pushDeviceStatus({ device: deviceName, is_on: false, error: 'timeout' });
                    
                    console.warn(`[DeviceControl] Timeout (6s): ${deviceName} → marked failed`);
                }
            } catch (err) {
                console.error('Timeout check error:', err);
            }
        }, 6000); // Ngưỡng timeout 6 giây được quy định tại bản cập nhật tối ưu hiệu năng

        // Phản hồi về Frontend ngay lập tức rằng "lệnh đã được tiếp nhận và đang xử lý"
        // Frontend sẽ hiển thị Loading Spinner chờ.
        res.json({ success: true, log });
    } catch (err) {
        next(err);
    }
};

// Xuất các hàm Controller để file Router (deviceRoutes.js) có thể sử dụng
module.exports = { getStatus, getHistory, control };
