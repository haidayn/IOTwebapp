import { useEffect, useRef, useState } from 'react';
import { Chart, LineElement, PointElement, LineController, CategoryScale,
         LinearScale, Filler, Tooltip } from 'chart.js';
import { getSensorHistory } from '../../services/api';

Chart.register(LineElement, PointElement, LineController, CategoryScale,
               LinearScale, Filler, Tooltip);

const TABS = [
  {
    key: 'temperature',
    label: 'Temperature',
    color: '#ef4444',
    unit: '°C',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/>
      </svg>
    ),
  },
  {
    key: 'humidity',
    label: 'Humidity',
    color: '#3b6cf6',
    unit: '%',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2.5s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z"/>
      </svg>
    ),
  },
  {
    key: 'light',
    label: 'Light',
    color: '#f59e0b',
    unit: 'lux',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
];

export default function SensorChart() {
  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading]     = useState(false);

  const tab = TABS[activeTab];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getSensorHistory({ sensorName: tab.key, limit: 30, sortBy: 'date', sortDir: 'ASC' })
      .then(res => {
        if (cancelled) return;
        const rows = res.data || [];
        const labels = rows.map(r => {
          const d = new Date(r.date);
          return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        });
        const values = rows.map(r => r.value);

        const ctx = canvasRef.current;
        if (!ctx) return;

        // Tạo gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, `${tab.color}55`);
        gradient.addColorStop(1, `${tab.color}00`);

        if (chartRef.current) {
          // Update data chứ không tạo lại chart
          chartRef.current.data.labels = labels;
          chartRef.current.data.datasets[0].data = values;
          chartRef.current.data.datasets[0].borderColor = tab.color;
          chartRef.current.data.datasets[0].backgroundColor = gradient;
          chartRef.current.update('active');
        } else {
          chartRef.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                data: values,
                borderColor: tab.color,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: tab.color,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: tab.color,
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  displayColors: false,
                  callbacks: {
                    label: ctx => `${ctx.parsed.y} ${tab.unit}`,
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: false,
                  ticks: { color: '#888' },
                  grid: { color: '#eef0f6' },
                },
                x: {
                  ticks: { color: '#888', maxTicksLimit: 10 },
                  grid: { display: false },
                },
              },
            },
          });
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeTab, tab.key, tab.color, tab.unit]);

  // Destroy chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3>{tab.label} Report</h3>
        <div className="chart-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              title={t.label}
              className={activeTab === i ? 'active' : ''}
              onClick={() => setActiveTab(i)}
              style={activeTab === i ? { borderColor: t.color, color: t.color, background: `${t.color}18` } : {}}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap" style={{ position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 1 }}>
            <div className="spinner" />
          </div>
        )}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
