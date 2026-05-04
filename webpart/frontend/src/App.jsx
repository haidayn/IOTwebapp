import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import SensorHistory from './pages/SensorHistory';
import DeviceHistory from './pages/DeviceHistory';
import Profile from './pages/Profile';
import Statistics from './pages/Statistics';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sensor-history" element={<SensorHistory />} />
          <Route path="device-history" element={<DeviceHistory />} />
          <Route path="statistics"     element={<Statistics />} />
          <Route path="profile"        element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
