/**
 * StatCard — Hiển thị giá trị cảm biến (Temp / Humidity / Light)
 * Props:
 *   label   {string}    - tên cảm biến
 *   value   {number|null}
 *   unit    {string}    - đơn vị hiển thị
 *   icon    {ReactNode}
 */
export default function StatCard({ label, value, unit, icon }) {
  const displayVal = value !== null && value !== undefined
    ? `${typeof value === 'number' ? value.toFixed(1) : value} ${unit}`
    : '—';

  return (
    <div className="card stat">
      <div className="stat-head">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">{displayVal}</div>
    </div>
  );
}
