import { useState, useEffect, useCallback } from 'react';
import { getStatistics, getAvailableMonths } from '../services/api';

/* ─── Device icon map ─── */
const DeviceIcon = ({ name }) => {
  const icons = {
    fan: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.5 2a2 2 0 0 1 3 0c1 2 0 4-2 5 2 1 4 0 5-2a2 2 0 0 1 0 3c-2 1-4 0-5 2 1 2 4 2 5 1a2 2 0 0 1 0 3c-2 1-4 0-5-2-1 2 0 4 2 5a2 2 0 0 1-3 0c-1-2 0-4 2-5-2-1-4 0-5 2a2 2 0 0 1 0-3c2-1 4 0 5-2-1-2-4-2-5-1a2 2 0 0 1 0-3c2-1 4 0 5 2 1-2 0-4-2-5Z"/>
        <circle cx="12" cy="12" r="1.5"/>
      </svg>
    ),
    air: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="13" rx="2"/>
        <path d="M9 21h6M12 17v4"/>
        <path d="M7 11h10M7 8h10"/>
      </svg>
    ),
    light: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6M10 22h4"/>
      </svg>
    ),
    tv: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="15" rx="2"/>
        <path d="M8 21h8M12 18v3"/>
      </svg>
    ),
    fridge: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <path d="M4 10h16"/>
        <path d="M9 6v2M9 14v4"/>
      </svg>
    ),
  };
  return icons[name?.toLowerCase()] || (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
};

const DEVICE_LABELS = {
  fan:    'Fan',
  air:    'Air Conditioner',
  light:  'Light',
  tv:     'TV',
  fridge: 'Fridge',
};

/* ─── Helpers ─── */
function getWeeksInMonth(year, month) {
  // Trả về số tuần (1-4 hoặc 1-5) trong tháng
  const lastDay = new Date(year, month, 0).getDate();
  return Math.ceil(lastDay / 7);
}

function getWeekDayRange(year, month, week) {
  // Trả về { startDay, endDay } của tuần trong tháng
  const startDay = (week - 1) * 7 + 1;
  const endDay   = Math.min(week * 7, new Date(year, month, 0).getDate());
  return { startDay, endDay };
}

function pad(n) { return String(n).padStart(2, '0'); }

/* ─── Main Component ─── */
export default function Statistics() {
  const now = new Date();

  const [availableMonths, setAvailableMonths] = useState([]);
  const [stats,           setStats]           = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [rangeLabel,      setRangeLabel]      = useState('');

  // Filter state
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1); // 1-indexed, 'all' = null
  const [selWeek,  setSelWeek]  = useState(null);  // null = tất cả
  const [selDay,   setSelDay]   = useState('');     // 'YYYY-MM-DD' or ''

  // Derived: weeks available for current month
  const totalWeeks = selMonth ? getWeeksInMonth(selYear, selMonth) : 0;

  // Min/max date for the day picker (constrained by week if selected)
  const dayPickerMin = (() => {
    if (!selMonth) return '';
    if (selWeek) {
      const { startDay } = getWeekDayRange(selYear, selMonth, selWeek);
      return `${selYear}-${pad(selMonth)}-${pad(startDay)}`;
    }
    return `${selYear}-${pad(selMonth)}-01`;
  })();

  const dayPickerMax = (() => {
    if (!selMonth) return '';
    if (selWeek) {
      const { endDay } = getWeekDayRange(selYear, selMonth, selWeek);
      return `${selYear}-${pad(selMonth)}-${pad(endDay)}`;
    }
    const lastDay = new Date(selYear, selMonth, 0).getDate();
    return `${selYear}-${pad(selMonth)}-${pad(lastDay)}`;
  })();

  /* ── Load available months once ── */
  useEffect(() => {
    getAvailableMonths()
      .then(setAvailableMonths)
      .catch(() => {/* non-critical */});
  }, []);

  /* ── Fetch stats whenever filters change ── */
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { year: selYear };
      if (selMonth) params.month = selMonth;
      if (selWeek)  params.week  = selWeek;
      if (selDay)   params.day   = selDay;

      const res = await getStatistics(params);
      setStats(res.data || []);

      // Build range label
      if (selDay) {
        setRangeLabel(`Ngày ${selDay}`);
      } else if (selWeek) {
        const { startDay, endDay } = getWeekDayRange(selYear, selMonth, selWeek);
        setRangeLabel(`Tuần ${selWeek} (${pad(startDay)}/${pad(selMonth)} – ${pad(endDay)}/${pad(selMonth)}/${selYear})`);
      } else if (selMonth) {
        setRangeLabel(`Tháng ${selMonth}/${selYear}`);
      } else {
        setRangeLabel(`Năm ${selYear}`);
      }
    } catch (err) {
      setError('Không thể tải dữ liệu thống kê.');
      console.error('[Statistics] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selYear, selMonth, selWeek, selDay]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Handlers ── */
  const handleMonthChange = (e) => {
    const val = e.target.value;
    setSelMonth(val ? parseInt(val) : null);
    setSelWeek(null);
    setSelDay('');
  };

  const handleWeekChange = (e) => {
    const val = e.target.value;
    setSelWeek(val ? parseInt(val) : null);
    setSelDay('');
  };

  const handleDayChange = (e) => {
    setSelDay(e.target.value || '');
  };

  const handleReset = () => {
    setSelYear(now.getFullYear());
    setSelMonth(now.getMonth() + 1);
    setSelWeek(null);
    setSelDay('');
  };

  /* ── Unique years from availableMonths ── */
  const availableYears = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);
  const availableMonthsForYear = availableMonths.filter(m => m.year === selYear).map(m => m.month);

  return (
    <>
      <h1 className="page-title">Thống Kê Thao Tác</h1>

      {/* ─── Filter bar ─── */}
      <section className="stats-filter-bar">
        {/* Year */}
        <div className="filter-group">
          <label htmlFor="filter-year" className="filter-label">Năm</label>
          <select
            id="filter-year"
            className="filter-select"
            value={selYear}
            onChange={e => { setSelYear(parseInt(e.target.value)); setSelMonth(null); setSelWeek(null); setSelDay(''); }}
          >
            {(availableYears.length ? availableYears : [now.getFullYear()]).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="filter-group">
          <label htmlFor="filter-month" className="filter-label">Tháng</label>
          <select
            id="filter-month"
            className="filter-select"
            value={selMonth ?? ''}
            onChange={handleMonthChange}
          >
            <option value="">Tất cả</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const hasData = availableMonthsForYear.includes(m);
              return (
                <option key={m} value={m}>
                  {`Tháng ${m}`}{hasData ? '' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Week — chỉ hiện khi đã chọn tháng */}
        {selMonth && (
          <div className="filter-group">
            <label htmlFor="filter-week" className="filter-label">Tuần</label>
            <select
              id="filter-week"
              className="filter-select"
              value={selWeek ?? ''}
              onChange={handleWeekChange}
            >
              <option value="">Tất cả</option>
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => {
                const { startDay, endDay } = getWeekDayRange(selYear, selMonth, w);
                return (
                  <option key={w} value={w}>
                    Tuần {w} ({pad(startDay)}/{pad(selMonth)} – {pad(endDay)}/{pad(selMonth)})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Day picker — chỉ hiện khi đã chọn tháng */}
        {selMonth && (
          <div className="filter-group">
            <label htmlFor="filter-day" className="filter-label">Ngày</label>
            <input
              id="filter-day"
              type="date"
              className="filter-select"
              value={selDay}
              min={dayPickerMin}
              max={dayPickerMax}
              onChange={handleDayChange}
            />
          </div>
        )}

        {/* Reset */}
        <button
          id="stats-reset-btn"
          className="btn-reset"
          onClick={handleReset}
          title="Đặt lại về tháng hiện tại"
        >
          ↺ Reset
        </button>
      </section>

      {/* ─── Range label ─── */}
      <p className="stats-range-label">
        {loading ? 'Đang tải...' : rangeLabel && `Hiển thị: ${rangeLabel}`}
      </p>

      {/* ─── Error ─── */}
      {error && <div className="error-msg">{error}</div>}

      {/* ─── Device cards ─── */}
      {!loading && !error && (
        <section className="stats-cards-grid">
          {stats.map(item => (
            <div key={item.device} className="stats-device-card">
              <div className="stats-card-icon">
                <DeviceIcon name={item.device} />
              </div>
              <div className="stats-card-body">
                <h2 className="stats-card-name">
                  {DEVICE_LABELS[item.device?.toLowerCase()] || item.device}
                </h2>
                <div className="stats-card-numbers">
                  <div className="stats-num stats-total">
                    <span className="stats-num-value">{item.total}</span>
                    <span className="stats-num-label">Tổng</span>
                  </div>
                  <div className="stats-num stats-on">
                    <span className="stats-num-value">{item.on}</span>
                    <span className="stats-num-label">Bật</span>
                  </div>
                  <div className="stats-num stats-off">
                    <span className="stats-num-value">{item.off}</span>
                    <span className="stats-num-label">Tắt</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {stats.length === 0 && (
            <p className="stats-empty">Không có dữ liệu trong khoảng thời gian này.</p>
          )}
        </section>
      )}
    </>
  );
}
