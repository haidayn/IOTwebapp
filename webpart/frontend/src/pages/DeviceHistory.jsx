import { useState, useCallback, useEffect } from 'react';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import StatusPill from '../components/ui/StatusPill';
import { getDeviceHistory } from '../services/api';

const fmtDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* Dropdown options */
const DEVICE_OPTIONS = [
  { value: 'all',   label: 'All Devices' },
  { value: 'fan',   label: 'Fan' },
  { value: 'air',   label: 'Air' },
  { value: 'light', label: 'Light' },
];

/**
 * Phân tích chuỗi thời gian linh hoạt → object các thành phần.
 *
 * QUY TẪC:
 *   "/" là dấu phân cách ngày/tháng/năm  → dd/mm/yyyy | mm/yyyy | dd/mm
 *   ":" là dấu phân cách giờ:phút:giây  → hh:mm:ss | hh:mm
 *   số đơn lẻ 4 chữ số              → yyyy
 *   số đơn lẻ ≤ 23                    → hh
 *
 * Có thể kết hợp bất kỳ thành phần nào cách nhau bằng khoảng trắng.
 * Ví dụ: "03/05" | "14:30" | "14" | "05/2026" | "03/05/2026 14:30"
 */
function parseFlexibleDate(raw) {
  if (!raw || !raw.trim()) return null;
  const result = {};

  for (const token of raw.trim().split(/\s+/)) {
    if (token.includes('/')) {
      // --- Phần ngày: dấu "/" ---
      const dp = token.split('/');
      if (dp.length === 3) {
        // dd/mm/yyyy
        const d = parseInt(dp[0]), m = parseInt(dp[1]), y = parseInt(dp[2]);
        if (!isNaN(d)) result.day   = d;
        if (!isNaN(m)) result.month = m;
        if (!isNaN(y)) result.year  = y;
      } else if (dp.length === 2) {
        const a = parseInt(dp[0]), b = parseInt(dp[1]);
        if (!isNaN(a) && !isNaN(b)) {
          if (b >= 1000) {
            // mm/yyyy
            result.month = a;
            result.year  = b;
          } else {
            // dd/mm
            result.day   = a;
            result.month = b;
          }
        }
      }
    } else if (token.includes(':')) {
      // --- Phần thời gian: dấu ":" ---
      const tp = token.split(':');
      const h  = parseInt(tp[0]);
      if (!isNaN(h)) result.hour = h;
      if (tp.length >= 2) { const mi = parseInt(tp[1]); if (!isNaN(mi)) result.minute = mi; }
      if (tp.length >= 3) { const s  = parseInt(tp[2]); if (!isNaN(s))  result.second = s;  }
    } else {
      // --- Số đơn lẻ ---
      const a = parseInt(token);
      if (!isNaN(a)) {
        if (token.length === 4) result.year = a;  // yyyy
        else if (a <= 23)       result.hour = a;  // hh
      }
    }
  }

  return Object.keys(result).length ? result : null;
}

export default function DeviceHistory() {
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPgs] = useState(1);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(10);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fetched, setFetched]     = useState(false);

  /* Filter state */
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [exactDate, setExactDate]       = useState('');

  const buildParams = useCallback((pg, lmt, reset = false) => {
    const params = { page: pg, limit: lmt };
    if (!reset && deviceFilter && deviceFilter !== 'all') {
      params.deviceName = deviceFilter;
    }
    if (!reset && exactDate.trim()) {
      const parsed = parseFlexibleDate(exactDate);
      if (parsed) params.exactDate = JSON.stringify(parsed);
    }
    return params;
  }, [deviceFilter, exactDate]);

  const fetchData = useCallback(async (pg = 1, lmt = limit, resetFilters = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(pg, lmt, resetFilters);
      const res = await getDeviceHistory(params);
      setRows(res.data || []);
      setTotal(res.total || 0);
      setTotalPgs(res.totalPages || 1);
      setPage(pg);
      setFetched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, buildParams]);

  const handleApply = () => fetchData(1, limit);

  const handleReset = () => {
    setDeviceFilter('all');
    setExactDate('');
    fetchData(1, limit, true);
  };

  useEffect(() => {
    fetchData(1, limit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange  = (p)   => fetchData(p, limit);
  const handleLimitChange = (lmt) => { setLimit(lmt); fetchData(1, lmt); };

  return (
    <>
      <h1 className="page-title">Device History</h1>

      <FilterBar
        filterLabel="Select Device"
        filterOptions={DEVICE_OPTIONS}
        filterValue={deviceFilter}
        onFilterChange={setDeviceFilter}
        exactDate={exactDate}
        onExactDateChange={setExactDate}
        onApply={handleApply}
        onReset={handleReset}
      />

      {error && <div className="error-msg">{error}</div>}

      <div className="table-wrap">
        {loading ? (
          <div className="loading-wrap"><div className="loading-spinner" /></div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Device</th>
                <th>Action</th>
                <th>Status</th>
                <th>Running</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    {fetched ? 'No records found.' : 'Use the filters above and click Search.'}
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.ID}>
                  <td>{row.ID}</td>
                  <td style={{ textTransform: 'capitalize' }}>{row.device?.name || '—'}</td>
                  <td>{row.action === 'ON' ? 'Turn ON' : row.action === 'OFF' ? 'Turn OFF' : row.action}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td>
                    {row.running === 1
                      ? <StatusPill status="running" label="Running" />
                      : '—'}
                  </td>
                  <td>{fmtDate(row.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && fetched && totalPages > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        )}
      </div>

      {fetched && !loading && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
          Total: {total} record{total !== 1 ? 's' : ''}
        </p>
      )}
    </>
  );
}
