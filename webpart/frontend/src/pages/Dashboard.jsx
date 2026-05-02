import { useState, useCallback, useEffect } from 'react';
import StatCard from '../components/ui/StatCard';
import DeviceCard from '../components/ui/DeviceCard';
import SensorChart from '../components/ui/SensorChart';
import { getDeviceStatus, controlDevice, getSensorHistory } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';

/* ─── icons ─── */
const TempIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/>
  </svg>
);
const HumIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2.5s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z"/>
  </svg>
);
const LightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);
const FanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.5 2a2 2 0 0 1 3 0c1 2 0 4-2 5 2 1 4 0 5-2a2 2 0 0 1 0 3c-2 1-4 0-5 2 1 2 4 2 5 1a2 2 0 0 1 0 3c-2 1-4 0-5-2-1 2 0 4 2 5a2 2 0 0 1-3 0c-1-2 0-4 2-5-2-1-4 0-5 2a2 2 0 0 1 0-3c2-1 4 0 5-2-1-2-4-2-5-1a2 2 0 0 1 0-3c2-1 4 0 5 2 1-2 0-4-2-5Z"/>
    <circle cx="12" cy="12" r="1.5"/>
  </svg>
);
const AirIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="13" rx="2"/>
    <path d="M9 21h6M12 17v4"/>
    <path d="M7 11h10M7 8h10"/>
  </svg>
);
const LedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
    <path d="M9 18h6M10 22h4"/>
  </svg>
);

const DEVICES = [
  { key: 'fan',   name: 'Fan',             icon: <FanIcon /> },
  { key: 'air',   name: 'Air Conditioner', icon: <AirIcon /> },
  { key: 'light', name: 'Light',           icon: <LedIcon /> },
];

export default function Dashboard() {
  const [sensors, setSensors]      = useState({ temperature: null, humidity: null, light: null });
  const [sensorHistory, setHistory] = useState({});   // { temperature: [], humidity: [], light: [] }
  const [devStatus, setDevStatus]   = useState({ fan: null, air: null, light: null });
  const [pending, setPending]       = useState({});
  const [initError, setInitError]   = useState(null);  // Initial page-load error only

  /* ─── Toast system (req2 §4.2) ─── */
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((msg, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  /* ─── PHASE 1: Load initial sensor history → populate chart + stat cards ─── */
  /* Requirements §2.2: Frontend → GET /api/sensors/history on Dashboard mount  */
  useEffect(() => {
    const loadAll = async () => {
      try {
        // Fetch DESC (newest first), then reverse → chronological order for chart
        const [tempRes, humRes, lightRes, statusRes] = await Promise.all([
          getSensorHistory({ sensorName: 'temperature', limit: 30, sortBy: 'date', sortDir: 'DESC' }),
          getSensorHistory({ sensorName: 'humidity',    limit: 30, sortBy: 'date', sortDir: 'DESC' }),
          getSensorHistory({ sensorName: 'light',       limit: 30, sortBy: 'date', sortDir: 'DESC' }),
          getDeviceStatus(),
        ]);

        const hist = {
          temperature: (tempRes.data  || []).slice().reverse(),  // ASC order for chart
          humidity:    (humRes.data   || []).slice().reverse(),
          light:       (lightRes.data || []).slice().reverse(),
        };
        setHistory(hist);

        // Derive latest stat card values from the most recent history record
        const latest = {};
        if (hist.temperature.length) latest.temperature = hist.temperature[hist.temperature.length - 1].value;
        if (hist.humidity.length)    latest.humidity    = hist.humidity[hist.humidity.length - 1].value;
        // Light inversion: hardware 1=tối, 0=sáng → display 1=sáng, 0=tối
        if (hist.light.length)       latest.light = 1 - hist.light[hist.light.length - 1].value;
        setSensors(prev => ({ ...prev, ...latest }));

        setDevStatus(statusRes);
      } catch (err) {
        console.error('[Dashboard] Initial load error:', err.message);
        setInitError('Failed to load initial data.');
      }
    };
    loadAll();
  }, []);

  /* WebSocket handlers */
  const handleSensorPush = useCallback((payload) => {
    const normalized = { ...payload };
    // Light inversion: hardware 1=tối, 0=sáng → display 1=sáng, 0=tối
    if (normalized.light !== undefined && normalized.light !== null) {
      normalized.light = 1 - normalized.light;
    }
    setSensors(prev => ({ ...prev, ...normalized }));
  }, []);

  /* Req2 §BƯỚC 14 + §4.2 Rollback handler */
  const handleDevicePush = useCallback(async (payload) => {
    const { device, is_on, error: devErr } = payload;
    if (!device) return;

    if (devErr) {
      /* ─── ROLLBACK (req2 §4.2): Re-fetch DB state, replace Waiting with actual DB status ─── */
      try {
        const freshStatus = await getDeviceStatus();
        setDevStatus(freshStatus);
      } catch {
        // Fallback: set device to false if DB fetch also fails
        setDevStatus(prev => ({ ...prev, [device]: false }));
      }
      setPending(prev => ({ ...prev, [device]: false }));
      showToast(`Lệnh "${device}" thất bại: ${devErr}. Đã khôi phục trạng thái.`, 'error');
    } else {
      /* ─── Success: update device state with confirmed hardware response ─── */
      setDevStatus(prev => ({ ...prev, [device]: is_on }));
      setPending(prev => ({ ...prev, [device]: false }));
    }
  }, [showToast]);

  useWebSocket(handleSensorPush, handleDevicePush);

  /* Toggle device — req2 §BƯỚC 1-3 */
  const handleToggle = async (deviceKey, action) => {
    setPending(prev => ({ ...prev, [deviceKey]: true }));  // Bước 2: Waiting
    try {
      await controlDevice(deviceKey, action);              // Bước 3: POST /api/device/control
    } catch (err) {
      /* HTTP error → immediate rollback without waiting for WS */
      setPending(prev => ({ ...prev, [deviceKey]: false }));
      showToast(`Không gửi được lệnh: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      {/* Initial load errors (page-level, non-dismissable) */}
      {initError && <div className="error-msg">{initError}</div>}

      {/* Stats */}
      <section className="stats-row">
        <StatCard label="Temperature" value={sensors.temperature} unit="°C"   icon={<TempIcon />} />
        <StatCard label="Humidity"    value={sensors.humidity}    unit="%"    icon={<HumIcon />}  />
        {/* Light: no unit, display Sáng/Tối — inverted from hardware raw value */}
        <StatCard
          label="Light"
          value={sensors.light !== null && sensors.light !== undefined
            ? (sensors.light === 1 ? 'Sáng' : 'Tối')
            : null}
          unit=""
          icon={<LightIcon />}
        />
      </section>

      {/* Devices + Chart */}
      <section className="dashboard-grid">
        <div className="devices">
          {DEVICES.map(({ key, name, icon }) => (
            <DeviceCard
              key={key}
              deviceKey={key}
              name={name}
              icon={icon}
              isOn={devStatus[key]}
              pending={!!pending[key]}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* ─── Chart: receives pre-loaded history (Phase 1) + realtime stream (Phase 2) ─── */}
        <SensorChart initialHistory={sensorHistory} latestData={sensors} />
      </section>

      {/* ─── Toast container — req2 §4.2 rollback notifications ─── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.msg}</span>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>×</button>
          </div>
        ))}
      </div>
    </>
  );
}
