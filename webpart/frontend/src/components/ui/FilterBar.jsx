/**
 * FilterBar — Thanh lọc dùng chung cho Sensor/Device History
 *
 * Props:
 *   searchPlaceholder {string}
 *   searchValue       {string}
 *   onSearchChange    {function(value)}
 *
 *   startDate         {string}   - datetime-local value
 *   endDate           {string}   - datetime-local value
 *   onStartChange     {function(value)}
 *   onEndChange       {function(value)}
 *
 *   onApply           {function} - gọi khi bấm Search
 *   onReset           {function} - reset toàn bộ filter
 */
export default function FilterBar({
  searchPlaceholder = 'Search…',
  searchValue = '',
  onSearchChange,
  startDate = '',
  endDate = '',
  onStartChange,
  onEndChange,
  onApply,
  onReset,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onApply?.();
  };

  return (
    <div className="filter-bar">
      {/* Search input */}
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Date range */}
      <label>From</label>
      <input
        type="datetime-local"
        value={startDate}
        onChange={e => onStartChange?.(e.target.value)}
        step="1"
        title="Hỗ trợ HH:mm:ss"
      />
      <label>To</label>
      <input
        type="datetime-local"
        value={endDate}
        onChange={e => onEndChange?.(e.target.value)}
        step="1"
        title="Hỗ trợ HH:mm:ss"
      />

      {/* Actions */}
      <button className="btn-primary" onClick={onApply}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        Search
      </button>
      <button className="btn-reset" onClick={onReset}>Reset</button>
    </div>
  );
}
