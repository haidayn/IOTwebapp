const { Sensor, SensorData } = require('../models'); // Tải các model giao tiếp với CSDL (bảng `sensor` và `sensor_data`)
const { Op, fn, col, where: seqWhere } = require('sequelize'); // Tải các toán tử lọc và hàm build query của Sequelize
const sequelize = require('../config/database'); // Tải đối tượng kết nối database để gọi raw query khi cần thiết

// ============================================================================
// API: GET /api/sensors/latest
// Lấy giá trị ĐO ĐƯỢC MỚI NHẤT của TẤT CẢ các cảm biến đang hoạt động.
// Dùng để hiển thị lên 3 thẻ Stat Cards (Nhiệt độ, Độ ẩm, Ánh sáng) ở giao diện trang chủ.
// ============================================================================
const getLatest = async (req, res, next) => {
    try {
        // Truy vấn lấy danh sách toàn bộ các cảm biến (ví dụ: temp, humid, light)
        const sensors = await Sensor.findAll();
        const result = {}; // Khởi tạo một Object JSON rỗng để chứa kết quả trả về

        // Lặp qua từng cảm biến để tìm dòng dữ liệu có thời gian mới nhất của nó
        for (const sensor of sensors) {
            // Tìm 1 bản ghi duy nhất (findOne)
            const latest = await SensorData.findOne({
                where: { IDsensor: sensor.IDsensor }, // Chỉ lấy dữ liệu thuộc về cảm biến hiện tại trong vòng lặp
                order: [['createAt', 'DESC']],        // Sắp xếp giảm dần theo thời gian để cái mới nhất nằm đầu tiên
            });
            // Nếu có kết quả, gắn giá trị của cảm biến đó vào object (vd: result['temperature'] = 35)
            // Nếu không có, gắn null
            result[sensor.nameSensor] = latest ? latest.value : null;
        }

        result.timestamp = new Date(); // Thêm một mốc thời gian đánh dấu lúc API phản hồi để frontend theo dõi
        res.json(result); // Gửi JSON phản hồi về cho client
    } catch (err) {
        // Bắt lỗi và chuyển nó xuống middleware xử lý lỗi chung của server
        next(err);
    }
};

/**
 * Xây dựng mảng conditions Sequelize cho exactDate linh hoạt.
 * Nhận chuỗi thời gian đã được parser dịch thành Object và xuất ra mảng điều kiện SQL (Op.and).
 *
 * @param {object} parsed   - Chứa các giá trị phân tích: { year?, month?, day?, hour?, minute?, second? }
 * @param {string} qualifiedCol - Tên cột CSDL đầy đủ để filter (vd: 'SensorData.createAt')
 */
function buildExactDateConditions(parsed, qualifiedCol) {
    if (!parsed || Object.keys(parsed).length === 0) return []; // Nếu người dùng không filter, trả về rỗng

    const { year, month, day, hour, minute, second } = parsed;

    // PHẦN 1: Nếu người dùng có truyền năm (year)
    // Lúc này ta có thể quy vùng điều kiện thành 1 dải thời gian từ `start` đến `end`
    if (year) {
        const y  = year;
        const mo = month  ?? null;
        const d  = day    ?? null;
        const h  = hour   ?? null;
        const mi = minute ?? null;
        const se = second ?? null;

        let start, end;

        if (mo !== null && d !== null && h !== null && mi !== null && se !== null) {
            // Trường hợp 1: Có tới tận giây. Ví dụ: 2026/05/03 14:30:45
            start = new Date(y, mo-1, d, h, mi, se);
            end   = new Date(y, mo-1, d, h, mi, se, 999);
        } else if (mo !== null && d !== null && h !== null && mi !== null) {
            // Trường hợp 2: Có tới phút. Lấy toàn bộ 60 giây trong phút đó.
            start = new Date(y, mo-1, d, h, mi, 0);
            end   = new Date(y, mo-1, d, h, mi, 59, 999);
        } else if (mo !== null && d !== null && h !== null) {
            // Trường hợp 3: Có tới giờ. Lấy toàn bộ 60 phút trong giờ đó.
            start = new Date(y, mo-1, d, h, 0, 0);
            end   = new Date(y, mo-1, d, h, 59, 59, 999);
        } else if (mo !== null && d !== null) {
            // Trường hợp 4: Có tới ngày. Lấy toàn bộ 24h trong ngày đó.
            start = new Date(y, mo-1, d, 0, 0, 0);
            end   = new Date(y, mo-1, d, 23, 59, 59, 999);
        } else if (mo !== null) {
            // Trường hợp 5: Chỉ có tháng và năm. Lấy từ ngày 1 tới ngày cuối tháng.
            start = new Date(y, mo-1, 1, 0, 0, 0);
            end   = new Date(y, mo, 0, 23, 59, 59, 999);
        } else {
            // Trường hợp 6: Chỉ có năm. Lấy toàn bộ 365 ngày của năm đó.
            start = new Date(y, 0, 1, 0, 0, 0);
            end   = new Date(y, 11, 31, 23, 59, 59, 999);
        }

        // Tách lấy chữ "createAt" để tạo key object
        // Trả về lệnh lọc `between` dải (start, end)
        return [{ [qualifiedCol.split('.').pop()]: { [Op.between]: [start, end] } }];
    }

    // PHẦN 2: Không có năm.
    // VD: Người dùng gõ "14:30" (nghĩa là mọi ngày, miễn là lúc 14:30).
    // Phải dùng các hàm built-in của MySQL để đối chiếu.
    const conditions = [];
    // fn('MONTH', col) dịch ra SQL là: MONTH(SensorData.createAt) = month
    if (month  !== undefined) conditions.push(seqWhere(fn('MONTH',  col(qualifiedCol)), month));
    if (day    !== undefined) conditions.push(seqWhere(fn('DAY',    col(qualifiedCol)), day));
    if (hour   !== undefined) conditions.push(seqWhere(fn('HOUR',   col(qualifiedCol)), hour));
    if (minute !== undefined) conditions.push(seqWhere(fn('MINUTE', col(qualifiedCol)), minute));
    if (second !== undefined) conditions.push(seqWhere(fn('SECOND', col(qualifiedCol)), second));

    return conditions;
}

// ============================================================================
// API: GET /api/sensors/history
// API Lấy dữ liệu lịch sử các thông số cảm biến môi trường.
// Hỗ trợ cực kỳ mạnh mẽ các tính năng Pagination, Sorting, Multi-filter.
// ============================================================================
const getHistory = async (req, res, next) => {
    try {
        // Đọc query string phân trang, mặc định hiển thị trang 1, mỗi trang 10 dòng
        const page    = parseInt(req.query.page)   || 1;
        const limit   = parseInt(req.query.limit)  || 10;
        // Xử lý cột cần Sort (Nếu query gởi 'date' thì tự hiểu là map với cột 'createAt' trong CSDL)
        const sortBy  = req.query.sortBy  === 'date' ? 'createAt' : (req.query.sortBy || 'createAt');
        // Chiều sort, mặc định DESC (Mới nhất nằm trên cùng)
        const sortDir = req.query.sortDir || 'DESC';
        // Số lượng bản ghi cần bỏ qua theo công thức phân trang cơ bản
        const offset  = (page - 1) * limit;

        // Khởi tạo mảng điều kiện cho các trường dữ liệu chung để tránh xung đột mệnh đề AND
        const andConditions = [];

        // 1. Nếu có ExactDate Filter từ FilterBar (Front-end đẩy dạng chuỗi JSON)
        if (req.query.exactDate) {
            try {
                // Parse chuỗi lấy Object thời gian
                const parsed = JSON.parse(req.query.exactDate);
                // Dùng qualified column để phân biệt khi lệnh có INNER JOIN bảng Sensor phía dưới
                const conds = buildExactDateConditions(parsed, 'SensorData.createAt');
                andConditions.push(...conds); // Thêm các điều kiện này vào mảng AND
            } catch (e) {
                console.warn('[SensorController] Invalid exactDate JSON:', req.query.exactDate);
            }
        }

        // 2. Tương thích ngược: (Chức năng cũ trước khi cải tiến UI) vẫn dùng startDate & endDate
        if (!req.query.exactDate) {
            if (req.query.startDate) andConditions.push({ createAt: { [Op.gte]: new Date(req.query.startDate) } });
            if (req.query.endDate)   andConditions.push({ createAt: { [Op.lte]: new Date(req.query.endDate) } });
        }

        // 3. Search Box Filtering (Tìm kiếm nhanh số liệu như 35.5)
        if (req.query.keyword) {
            let searchVal = req.query.keyword.trim();
            // Cố gắng ép kiểu String sang số, nếu hợp lệ sẽ loại bỏ các zero bị thừa ở đầu 0023 -> 23
            if (!isNaN(searchVal) && searchVal !== '') {
                searchVal = String(Number(searchVal));
            }
            // Thêm lệnh ép kiểu CAST trong SQL: Làm tròn cột value 2 số thập phân rồi so sánh chuỗi (LIKE '23%')
            andConditions.push(
                sequelize.where(
                    sequelize.cast(sequelize.fn('ROUND', sequelize.col('SensorData.value'), 2), 'CHAR'),
                    { [Op.like]: `${searchVal}%` }
                )
            );
        }

        // Build object nơi chứa điều kiện chính thức để đẩy vào ORM Sequelize
        const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

        // 4. Lọc cụ thể loại cảm biến (Temperature, Humidity, Light)
        const sensorWhere = {};
        if (req.query.sensorName && req.query.sensorName !== 'all') {
            sensorWhere.nameSensor = req.query.sensorName;
        }

        // Truy xuất database và đếm luôn số dòng (dành cho bộ tính toán tổng số trang)
        const { count, rows } = await SensorData.findAndCountAll({
            where, // Gắn điều kiện đã xây dựng
            include: [{
                model:      Sensor,      // Gắn kết với bảng Cảm Biến
                as:         'sensor',    // Định danh Alias
                where:      Object.keys(sensorWhere).length ? sensorWhere : undefined, // Truy vấn có lọc
                attributes: ['nameSensor'], // Chỉ mang theo field tên, đỡ nặng RAM
            }],
            order:  [[sortBy, sortDir.toUpperCase()]], // Chạy Sort
            limit,  // Đóng Limit
            offset, // Đóng Offset
        });

        // Loop biến đổi các field SQL thô (Raw) thành Field DTO thân thiện cho Client App
        const data = rows.map(r => ({
            ID:     r.IDdata,
            value:  r.value,
            date:   r.createAt,
            sensor: { name: r.sensor?.nameSensor },
        }));

        // Trả kết quả kèm Meta Data phân trang
        res.json({ total: count, page, totalPages: Math.ceil(count / limit), data });
    } catch (err) {
        next(err); // Ủy thác lại cho ErrorHandler bắt lỗi crash
    }
};

// Đăng ký Export module
module.exports = { getLatest, getHistory };
