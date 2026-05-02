import { useState, useCallback } from 'react';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import StatusPill from '../components/ui/StatusPill';
import { getDeviceHistory, normalizeDateTime } from '../services/api';

const fmtDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function DeviceHistory() {
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPgs] = useState(1);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(10);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fetched, setFetched]     = useState(false);

  /* Filter state
     search = kết hợp: deviceName VÀ keyword (on/off/fail/#ID)
     Ta dùng 2 field riêng: deviceName và keyword */
  const [deviceName, setDeviceName] = useState('');
  const [keyword, setKeyword]       = useState('');
  const [startDate, setStart]       = useState('');
  const [endDate, setEnd]           = useState('');

  const fetchData = useCallback(async (pg = 1, lmt = limit) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pg,
        limit: lmt,
        ...(deviceName && { deviceName }),
        ...(keyword    && { keyword }),
        ...(startDate  && { fromDate: normalizeDateTime(startDate) }),
        ...(endDate    && { toDate:   normalizeDateTime(endDate)   }),
      };
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
  }, [limit, deviceName, keyword, startDate, endDate]);

  const handleApply = () => fetchData(1, limit);

  const handleReset = () => {
    setDeviceName(''); setKeyword('');
    setStart(''); setEnd('');
    setRows([]); setTotal(0); setTotalPgs(1); setPage(1); setFetched(false);
  };

  const handlePageChange  = (p)   => fetchData(p, limit);
  const handleLimitChange = (lmt) => { setLimit(lmt); fetchData(1, lmt); };

  /* Combined search: deviceName + keyword — cả 2 gộp trong 1 thanh search.
     Nếu người dùng nhập "fan:failed" → tách ra, nếu không thì coi toàn bộ là keyword */
  const handleSearchChange = (val) => {
    // Cú pháp tùy chọn: "fan failed" hoặc chỉ "fan" hoặc "failed" hay "#123"
    // Đơn giản nhất: nhập tên thiết bị → deviceName; còn lại → keyword
    const DEVICES = ['fan', 'air', 'light'];
    const parts   = val.trim().split(/\s+/);
    let dName  = '';
    let kword  = '';
    for (const p of parts) {
      if (DEVICES.includes(p.toLowerCase())) dName = p.toLowerCase();
      else kword = (kword + ' ' + p).trim();
    }
    setDeviceName(dName);
    setKeyword(kword);
  };

  const searchDisplayValue = [deviceName, keyword].filter(Boolean).join(' ');

  return (
    <>
      <h1 className="page-title">Device History</h1>

      <FilterBar
        searchPlaceholder="Filter: device name (fan/air/light) + keyword (on/off/fail/#ID)"
        searchValue={searchDisplayValue}
        onSearchChange={handleSearchChange}
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStart}
        onEndChange={setEnd}
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
