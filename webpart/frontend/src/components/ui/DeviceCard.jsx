/**
 * DeviceCard — Card ON/OFF cho 1 thiết bị
 * Props:
 *   name      {string}         - display name ("Fan", "Air Conditioner", "Light")
 *   deviceKey {string}         - API key ("fan", "air", "light")
 *   isOn      {boolean|null}   - null = unknown/loading
 *   pending   {boolean}        - đang chờ phản hồi từ thiết bị
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
        {isOn !== null && isOn !== undefined && !pending && (
          <span className={`status-pill ${isOn ? 'running' : 'failed'}`}>
            {isOn ? 'ON' : 'OFF'}
          </span>
        )}
      </div>

      {pending ? (
        <div className="toggle" style={{ justifyContent: 'center', padding: '4px 0' }}>
          <div className="spinner" />
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
