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
/**
 * Tạo Date object cho query Sequelize khi Sequelize config có timezone: '+07:00'.
 *
 * VÌ SAO CẦN HÀM NÀY:
 *   Sequelize với timezone:'+07:00' tự động cộng thêm +7h vào mọi Date object
 *   trước khi gửi sang MySQL. DB lưu giờ LOCAL (ví dụ 16:14:53 ICT).
 *   Nếu dùng `new Date(y, mo-1, d, h, mi, se)` → đây là local Date, Sequelize
 *   cộng thêm 7h → gửi 23:14:53 sang DB → KHÔNG KHỚP với 16:14:53 đã lưu.
 *
 * CÁCH FIX:
 *   Dùng `Date.UTC(y, mo-1, d, h, mi, se)` để tạo epoch mà UTC representation
 *   chính là giờ local người dùng nhập (VD: 16:14:53 UTC).
 *   Sequelize cộng thêm +7h → gửi 23:14:53? Không!
 *   THỰC RA Sequelize serialize theo offset: nó lưu date.toISOString() rồi apply
 *   timezone offset khi gửi. Với timezone:'+07:00', Sequelize gửi UTC+7 string.
 *   Date.UTC(2026,4,4,16,14,53) = 2026-05-04T16:14:53Z, Sequelize gửi
 *   "2026-05-04 23:14:53" → sai.
 *
 *   FIX THỰC SỰ: Dùng new Date(Date.UTC(y, mo-1, d, h, mi, se, ms) - 7*3600*1000)
 *   = fake UTC-7h, để Sequelize cộng +7h thành đúng giờ người dùng nhập.
 *   Tức là: truyền vào Date đại diện cho (giờ local - 7h) = UTC thực.
 *   Sequelize với tz+7 sẽ cộng thêm +7h → ra đúng giờ local lưu trong DB.
 */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // 7 giờ tính bằng ms

function makeLocalDate(y, mo, d, h, mi, se, ms = 0) {
    // Tạo UTC epoch tương ứng với giờ local (mo là 1-indexed)
    // Sau đó trừ 7h để bù cho việc Sequelize sẽ cộng +7h
    return new Date(Date.UTC(y, mo - 1, d, h, mi, se, ms) - TZ_OFFSET_MS);
}

function buildExactDateConditions(parsed, qualifiedCol) {
    if (!parsed || Object.keys(parsed).length === 0) return [];

    const { year, month, day, hour, minute, second } = parsed;

    // PHẦN 1: Có năm → tạo khoảng [start, end] khớp với giờ local trong DB
    if (year) {
        const y  = year;
        const mo = month  ?? null;
        const d  = day    ?? null;
        const h  = hour   ?? null;
        const mi = minute ?? null;
        const se = second ?? null;

        let start, end;

        if (mo !== null && d !== null && h !== null && mi !== null && se !== null) {
            // Chính xác tới giây
            start = makeLocalDate(y, mo, d, h, mi, se, 0);
            end   = makeLocalDate(y, mo, d, h, mi, se, 999);
        } else if (mo !== null && d !== null && h !== null && mi !== null) {
            // Chính xác tới phút
            start = makeLocalDate(y, mo, d, h, mi, 0, 0);
            end   = makeLocalDate(y, mo, d, h, mi, 59, 999);
        } else if (mo !== null && d !== null && h !== null) {
            // Chính xác tới giờ
            start = makeLocalDate(y, mo, d, h, 0, 0, 0);
            end   = makeLocalDate(y, mo, d, h, 59, 59, 999);
        } else if (mo !== null && d !== null) {
            // Cả ngày
            start = makeLocalDate(y, mo, d, 0, 0, 0, 0);
            end   = makeLocalDate(y, mo, d, 23, 59, 59, 999);
        } else if (mo !== null) {
            // Cả tháng
            const lastDay = new Date(y, mo, 0).getDate();
            start = makeLocalDate(y, mo, 1,       0,  0,  0, 0);
            end   = makeLocalDate(y, mo, lastDay, 23, 59, 59, 999);
        } else {
            // Cả năm
            start = makeLocalDate(y, 1,  1,  0,  0,  0, 0);
            end   = makeLocalDate(y, 12, 31, 23, 59, 59, 999);
        }

        return [{ [qualifiedCol.split('.').pop()]: { [Op.between]: [start, end] } }];
    }

    // PHẦN 2: Không có năm → dùng hàm MySQL để so sánh từng thành phần
    // DB lưu giờ local (UTC+7) nên HOUR(col) trả về đúng giờ local, không cần CONVERT_TZ
    const conditions = [];
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
