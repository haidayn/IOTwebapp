/**
 * StatusPill — Badge hiển thị trạng thái
 * Props:
 *   status {string} - 'success' | 'failed' | 'running' | 'pending'
 *   label  {string} - text hiển thị (mặc định = capitalize(status))
 */
export default function StatusPill({ status, label }) {
  const cls = status?.toLowerCase() || 'pending';
  const text = label || cls.charAt(0).toUpperCase() + cls.slice(1);
  return <span className={`status-pill ${cls}`}>{text}</span>;
}
