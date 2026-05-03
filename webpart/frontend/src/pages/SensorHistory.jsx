import { useState, useCallback, useEffect } from 'react';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import { getSensorHistory } from '../services/api';

/* Format date string */
const fmtDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* Unit mapping per sensor name */
const UNITS = { temperature: '°C', humidity: '%', light: 'lux' };

/* Dropdown options */
const SENSOR_OPTIONS = [
  { value: 'all',         label: 'All Sensors' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity',    label: 'Humidity' },
  { value: 'light',       label: 'Light' },
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
 *
 * Returns { year?, month?, day?, hour?, minute?, second? } hoặc null nếu không parse được.
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

export default function SensorHistory() {
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPgs] = useState(1);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(10);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fetched, setFetched]     = useState(false);

  /* Filter state */
  const [sensorFilter, setSensorFilter] = useState('all');
  const [exactDate, setExactDate]       = useState('');
  const [keyword, setKeyword]           = useState('');

  /* Sort state */
  const [sortBy, setSortBy]   = useState('date');
  const [sortDir, setSortDir] = useState('DESC');

  const buildParams = useCallback((pg, lmt, reset = false) => {
    const params = {
      page: pg,
      limit: lmt,
      sortBy:  reset ? 'date' : sortBy,
      sortDir: reset ? 'DESC' : sortDir,
    };
    if (!reset && sensorFilter && sensorFilter !== 'all') {
      params.sensorName = sensorFilter;
    }
    if (!reset && exactDate.trim()) {
      const parsed = parseFlexibleDate(exactDate);
      if (parsed) params.exactDate = JSON.stringify(parsed);
    }
    if (!reset && keyword.trim()) {
      params.keyword = keyword.trim();
    }
    return params;
  }, [sortBy, sortDir, sensorFilter, exactDate, keyword]);

  const fetchData = useCallback(async (pg = 1, lmt = limit, resetFilters = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(pg, lmt, resetFilters);
      const res = await getSensorHistory(params);
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
    setSensorFilter('all');
    setExactDate('');
    setKeyword('');
    setSortBy('date');
    setSortDir('DESC');
    fetchData(1, limit, true);
  };

  useEffect(() => {
    fetchData(1, limit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (col) => {
    const newDir = sortBy === col && sortDir === 'ASC' ? 'DESC' : 'ASC';
    setSortBy(col);
    setSortDir(newDir);
    fetchData(1, limit);
  };

  const handlePageChange  = (p)   => fetchData(p, limit);
  const handleLimitChange = (lmt) => { setLimit(lmt); fetchData(1, lmt); };

  const sortIcon = (col) => {
    if (sortBy !== col) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon">{sortDir === 'ASC' ? '↑' : '↓'}</span>;
  };

  return (
    <>
      <h1 className="page-title">Sensor History</h1>

      <FilterBar
        filterLabel="Select Sensor"
        filterOptions={SENSOR_OPTIONS}
        filterValue={sensorFilter}
        onFilterChange={setSensorFilter}
        exactDate={exactDate}
        onExactDateChange={setExactDate}
        keyword={keyword}
        onKeywordChange={setKeyword}
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
                <th className="sortable" onClick={() => handleSort('ID')}>
                  ID {sortIcon('ID')}
                </th>
                <th>Sensor</th>
                <th className="sortable" onClick={() => handleSort('value')}>
                  Value {sortIcon('value')}
                </th>
                <th className="sortable" onClick={() => handleSort('date')}>
                  Date {sortIcon('date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="table-empty">
                    {fetched ? 'No records found.' : 'Use the filters above and click Search.'}
                  </td>
                </tr>
              ) : rows.map(row => {
                const sName = row.sensor?.name || '';
                const unit  = UNITS[sName] || '';
                return (
                  <tr key={row.ID}>
                    <td>{row.ID}</td>
                    <td style={{ textTransform: 'capitalize' }}>{sName}</td>
                    <td>{row.value != null ? `${Number(row.value).toFixed(1)} ${unit}` : '—'}</td>
                    <td>{fmtDate(row.date)}</td>
                  </tr>
                );
              })}
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
