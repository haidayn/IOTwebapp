import { useState, useCallback } from 'react';
import StatCard from '../components/ui/StatCard';
import DeviceCard from '../components/ui/DeviceCard';
import SensorChart from '../components/ui/SensorChart';
import { getDeviceStatus, controlDevice, getSensorLatest } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import { useEffect } from 'react';

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
  const [sensors, setSensors]   = useState({ temperature: null, humidity: null, light: null });
  const [devStatus, setDevStatus] = useState({ fan: null, air: null, light: null });
  const [pending, setPending]   = useState({});        // { fan: true/false, ... }
  const [error, setError]       = useState(null);

  /* Load initial data */
  useEffect(() => {
    getSensorLatest().then(data => setSensors(data)).catch(console.error);
    getDeviceStatus().then(data => setDevStatus(data)).catch(console.error);
  }, []);

  /* WebSocket handlers */
  const handleSensorPush = useCallback((payload) => {
    setSensors(prev => ({ ...prev, ...payload }));
  }, []);

  const handleDevicePush = useCallback((payload) => {
    const { device, is_on, error: devErr } = payload;
    if (!device) return;
    setDevStatus(prev => ({ ...prev, [device]: is_on }));
    setPending(prev => ({ ...prev, [device]: false }));
    if (devErr) setError(`Device "${device}" failed: ${devErr}`);
  }, []);

  useWebSocket(handleSensorPush, handleDevicePush);

  /* Toggle device */
  const handleToggle = async (deviceKey, action) => {
    setPending(prev => ({ ...prev, [deviceKey]: true }));
    setError(null);
    try {
      await controlDevice(deviceKey, action);
    } catch (err) {
      setPending(prev => ({ ...prev, [deviceKey]: false }));
      setError(`Failed to send command: ${err.message}`);
    }
  };

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      {error && <div className="error-msg">{error}</div>}

      {/* Stats */}
      <section className="stats-row">
        <StatCard label="Temperature" value={sensors.temperature} unit="°C"   icon={<TempIcon />} />
        <StatCard label="Humidity"    value={sensors.humidity}    unit="%"    icon={<HumIcon />}  />
        <StatCard label="Light"       value={sensors.light}       unit="lux"  icon={<LightIcon />}/>
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

        <SensorChart />
      </section>
    </>
  );
}
