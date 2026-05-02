/**
 * DeviceCard — Card ON/OFF cho 1 thiết bị
 * Props:
 *   name      {string}         - display name ("Fan", "Air Conditioner", "Light")
 *   deviceKey {string}         - API key ("fan", "air", "light")
 *   isOn      {boolean|null}   - null = unknown/loading
 *   pending   {boolean}        - đang chờ phản hồi từ thiết bị (Waiting state — req2 §BƯỚC 2)
 *   onToggle  {function}       - (deviceKey, 'ON'|'OFF') => void
 *   icon      {ReactNode}
 */
export default function DeviceCard({ name, deviceKey, isOn, pending, onToggle, icon }) {
  const handleOn  = () => { if (!pending) onToggle(deviceKey, 'ON');  };
  const handleOff = () => { if (!pending) onToggle(deviceKey, 'OFF'); };

  return (
    <div className="card device-card">
      <div className="device-card-header">
        <h3>
          {icon}
          {name}
        </h3>
        {/* Status pill — shows WAITING during pending, ON/OFF when confirmed */}
        {pending ? (
          <span className="status-pill pending">Waiting</span>
        ) : (
          isOn !== null && isOn !== undefined && (
            <span className={`status-pill ${isOn ? 'running' : 'failed'}`}>
              {isOn ? 'ON' : 'OFF'}
            </span>
          )
        )}
      </div>

      {/* req2 §BƯỚC 2: Waiting state — spinner + "Đang xử lý..." label */}
      {pending ? (
        <div className="toggle" style={{ flexDirection: 'column', justifyContent: 'center', padding: '8px 0', gap: 6, border: 0 }}>
          <div className="spinner" />
          <span style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Đang xử lý…</span>
        </div>
      ) : (
        <div className="toggle">
          <button
            className={`btn-on${isOn ? ' active' : ''}`}
            onClick={handleOn}
            disabled={pending}
          >
            ON
          </button>
          <button
            className={`btn-off${!isOn && isOn !== null ? ' active' : ''}`}
            onClick={handleOff}
            disabled={pending}
          >
            OFF
          </button>
        </div>
      )}
    </div>
  );
}
