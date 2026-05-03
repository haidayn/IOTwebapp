/**
 * FilterBar — Thanh lọc dùng chung cho Sensor/Device History (v2)
 *
 * Props:
 *   filterLabel       {string}                  - nhãn dropdown (e.g. "Select Sensor")
 *   filterOptions     {Array<{value,label}>}     - danh sách option, value='all' là mặc định
 *   filterValue       {string}                   - giá trị đang chọn
 *   onFilterChange    {function(value)}
 *
 *   exactDate         {string}                   - chuỗi thời gian người dùng nhập (raw text)
 *   onExactDateChange {function(value)}
 *
 *   keyword           {string}                   - tìm kiếm theo giá trị cảm biến (tùy chọn)
 *   onKeywordChange   {function(value)}
 *
 *   onApply           {function} - gọi khi bấm Search
 *   onReset           {function} - reset toàn bộ filter
 */
import { useRef, useState } from 'react';

export default function FilterBar({
  filterLabel = 'Select…',
  filterOptions = [],
  filterValue = 'all',
  onFilterChange,
  extraSelects = [],   // [{ label, options:[{value,label}], value, onChange }]
  exactDate = '',
  onExactDateChange,
  keyword = '',
  onKeywordChange,
  onApply,
  onReset,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  /* Khi người dùng chọn qua picker (datetime-local) → convert sang
     dd/mm/yyyy hh:mm:ss để hiển thị trong text input */
  const handlePickerChange = (e) => {
    const val = e.target.value; // "yyyy-mm-ddThh:mm"
    if (!val) return;
    const [datePart, timePart] = val.split('T');
    const [y, m, d] = datePart.split('-');
    const timeStr = timePart ? ` ${timePart}:00` : '';
    onExactDateChange?.(`${d}/${m}/${y}${timeStr}`);
    setPickerOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onApply?.();
  };

  /* Chuyển dd/mm/yyyy hh:mm:ss → yyyy-mm-ddThh:mm để set giá trị picker */
  const toPickerValue = () => {
    if (!exactDate) return '';
    const parts = exactDate.trim().split(/\s+/);
    const datePart = parts[0] || '';
    const timePart = parts[1] || '';
    const dp = datePart.split('/');
    let yyyy = '', mm = '', dd = '';
    if (dp.length === 3) { [dd, mm, yyyy] = dp; }
    else if (dp.length === 2) { [mm, yyyy] = dp; dd = '01'; }
    else if (dp.length === 1 && dp[0].length === 4) { yyyy = dp[0]; mm = '01'; dd = '01'; }
    if (!yyyy || !mm || !dd) return '';
    const tp = timePart ? timePart.substring(0, 5) : '00:00';
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${tp}`;
  };

  return (
    <div className="filter-bar">
      {/* Dropdown selector */}
      <div className="filter-select-wrap">
        <label className="filter-select-label">{filterLabel}</label>
        <select
          className="filter-select"
          value={filterValue}
          onChange={e => onFilterChange?.(e.target.value)}
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Extra dropdowns (ví dụ: Action, Running) được inject từ trang cha */}
      {extraSelects.map((sel, i) => (
        <div className="filter-select-wrap" key={i}>
          <label className="filter-select-label">{sel.label}</label>
          <select
            className="filter-select"
            value={sel.value}
            onChange={e => sel.onChange(e.target.value)}
          >
            {sel.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ))}

      {/* Exact datetime text input + picker */}
      <div className="datetime-wrap">
        <div className="datetime-input-group">
          <svg className="dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <input
            type="text"
            className="datetime-text"
            placeholder="dd/mm/yyyy hh:mm:ss"
            value={exactDate}
            onChange={e => onExactDateChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {/* Nút mở native datetime picker */}
          <button
            className="dt-picker-btn"
            title="Chọn thời gian"
            onClick={() => setPickerOpen(v => !v)}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
        {pickerOpen && (
          <div className="dt-picker-popup">
            <input
              ref={pickerRef}
              type="datetime-local"
              step="1"
              value={toPickerValue()}
              onChange={handlePickerChange}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Value search — chỉ hiển thị khi có prop onKeywordChange */}
      {onKeywordChange !== undefined && (
        <div className="datetime-wrap" style={{ minWidth: 140, maxWidth: 200 }}>
          <div className="datetime-input-group">
            <svg className="dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              className="datetime-text"
              placeholder="Value (e.g. 35.5)"
              value={keyword}
              onChange={e => onKeywordChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      )}

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
