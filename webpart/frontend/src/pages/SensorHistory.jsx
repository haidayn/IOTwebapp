import { useState, useCallback, useEffect } from 'react';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import { getSensorHistory, normalizeDateTime } from '../services/api';

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
  const [search, setSearch]   = useState('');   // sensor name filter
  const [startDate, setStart] = useState('');
  const [endDate, setEnd]     = useState('');

  /* Sort state */
  const [sortBy, setSortBy]   = useState('date');
  const [sortDir, setSortDir] = useState('DESC');

  const fetchData = useCallback(async (pg = 1, lmt = limit, resetFilters = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pg,
        limit: lmt,
        sortBy: resetFilters ? 'date' : sortBy,
        sortDir: resetFilters ? 'DESC' : sortDir,
        ...(!resetFilters && search    && { sensorName: search }),
        ...(!resetFilters && startDate && { startDate: normalizeDateTime(startDate) }),
        ...(!resetFilters && endDate   && { endDate:   normalizeDateTime(endDate)   }),
      };
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
  }, [limit, search, startDate, endDate, sortBy, sortDir]);

  const handleApply = () => fetchData(1, limit);

  const handleReset = () => {
    setSearch(''); setStart(''); setEnd('');
    setSortBy('date'); setSortDir('DESC');
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
        searchPlaceholder="Filter by sensor name (temperature / humidity / light)"
        searchValue={search}
        onSearchChange={setSearch}
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
