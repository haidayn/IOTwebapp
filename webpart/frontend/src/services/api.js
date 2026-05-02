import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

/* ─── Sensor APIs ─── */

/** Lấy giá trị mới nhất của tất cả cảm biến */
export const getSensorLatest = () => api.get('/sensors/latest').then(r => r.data);

/**
 * Lấy lịch sử cảm biến
 * @param {Object} params - { page, limit, sensorName, startDate, endDate, sortBy, sortDir, keyword }
 */
export const getSensorHistory = (params = {}) => {
  const cleaned = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  }
  return api.get('/sensors/history', { params: cleaned }).then(r => r.data);
};

/* ─── Device APIs ─── */

/** Lấy trạng thái hiện tại của tất cả thiết bị */
export const getDeviceStatus = () => api.get('/device/status').then(r => r.data);

/**
 * Gửi lệnh điều khiển thiết bị
 * @param {string} device - tên thiết bị (fan/air/light)
 * @param {'ON'|'OFF'} action
 */
export const controlDevice = (device, action) =>
  api.post('/device/control', { device, action }).then(r => r.data);

/**
 * Lấy lịch sử hành động thiết bị
 * @param {Object} params - { page, limit, keyword, deviceName, fromDate, toDate }
 */
export const getDeviceHistory = (params = {}) => {
  const cleaned = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  }
  return api.get('/device-actions', { params: cleaned }).then(r => r.data);
};

/* ─── Datetime helpers ─── */

/**
 * Chuẩn hóa chuỗi datetime-local sang ISO 8601 UTC
 * Hỗ trợ:
 *   "2025-05-01T09:14"       → thêm :00 → ISO
 *   "2025-05-01T09:14:30"    → ISO
 */
export const normalizeDateTime = (dtStr) => {
  if (!dtStr) return undefined;
  // Nếu chỉ có HH:mm mà không có giây → tự thêm :00
  const normalized = dtStr.length === 16 ? `${dtStr}:00` : dtStr;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

export default api;
