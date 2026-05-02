import { useEffect, useRef, useState } from 'react';
import { Chart, LineElement, PointElement, LineController, CategoryScale,
         LinearScale, Filler, Tooltip } from 'chart.js';

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
    unit: '',   // no unit — shows Sáng/Tối
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
];

const fmt = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

/**
 * Y-axis configuration per sensor type
 * - Temperature : 0–50 °C, stepSize 2
 * - Humidity    : 0–100 %, stepSize 10
 * - Light       : 0–1 (Tối/Sáng), stepSize 1, custom tick labels
 */
function getYAxisConfig(tabKey) {
  switch (tabKey) {
    case 'temperature':
      return {
        beginAtZero: true,
        min: 0, max: 50,
        ticks: { color: '#888', stepSize: 2 },
        grid: { color: '#eef0f6' },
      };
    case 'humidity':
      return {
        beginAtZero: true,
        min: 0, max: 100,
        ticks: { color: '#888', stepSize: 10 },
        grid: { color: '#eef0f6' },
      };
    case 'light':
      return {
        beginAtZero: true,
        min: 0, max: 1,
        ticks: {
          color: '#888',
          stepSize: 1,
          callback: (v) => v === 1 ? 'Sáng' : 'Tối',
        },
        grid: { color: '#eef0f6' },
      };
    default:
      return {
        beginAtZero: false,
        ticks: { color: '#888' },
        grid: { color: '#eef0f6' },
      };
  }
}

/**
 * Tooltip label for a given tab
 */
function getTooltipLabel(tabKey, tabUnit) {
  if (tabKey === 'light') {
    return (ctx) => ctx.parsed.y === 1 ? 'Sáng' : 'Tối';
  }
  return (ctx) => `${ctx.parsed.y}${tabUnit ? ' ' + tabUnit : ''}`;
}

/**
 * Apply light value inversion to display:
 * Hardware: 1 = tối (dark), 0 = sáng (bright)
 * Display : 1 = sáng (bright), 0 = tối (dark)
 */
function invertLight(tabKey, rawValue) {
  return tabKey === 'light' ? 1 - rawValue : rawValue;
}

/**
 * SensorChart
 *
 * Props:
 *   initialHistory {Object}  — { temperature: [{date,value},...], humidity:[...], light:[...] }
 *                              Newest 30 records, reversed to chronological order (oldest→newest)
 *   latestData     {Object}  — { temperature, humidity, light, timestamp }
 *                              Light value already inverted by Dashboard before being passed in
 */
export default function SensorChart({ initialHistory = {}, latestData }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [activeTab, setActiveTab] = useState(0);

  const tab = TABS[activeTab];

  // ─── Phase 1 + Tab switch: render chart from pre-loaded history ───
  useEffect(() => {
    const rows   = initialHistory[tab.key] || [];
    const labels = rows.map(r => fmt(r.date));
    // Apply light inversion on history values
    const values = rows.map(r => invertLight(tab.key, r.value));

    const ctx = canvasRef.current;
    if (!ctx) return;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, `${tab.color}55`);
    gradient.addColorStop(1, `${tab.color}00`);

    const yAxisConfig = getYAxisConfig(tab.key);
    const tooltipLabel = getTooltipLabel(tab.key, tab.unit);

    if (chartRef.current) {
      const c = chartRef.current;
      c.data.labels                        = labels;
      c.data.datasets[0].data              = values;
      c.data.datasets[0].borderColor       = tab.color;
      c.data.datasets[0].backgroundColor   = gradient;
      c.data.datasets[0].pointBackgroundColor = tab.color;
      // Update Y-axis config
      c.options.scales.y = { ...yAxisConfig };
      c.options.plugins.tooltip.backgroundColor  = tab.color;
      c.options.plugins.tooltip.callbacks.label  = tooltipLabel;
      c.update('active');
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
              callbacks: { label: tooltipLabel },
            },
          },
          scales: {
            y: { ...yAxisConfig },
            x: {
              ticks: { color: '#888', maxTicksLimit: 10 },
              grid:  { display: false },
            },
          },
        },
      });
    }
  }, [activeTab, tab.key, tab.color, tab.unit, initialHistory]);

  // ─── Phase 2: Append real-time WebSocket point — sliding window 30 pts ───
  useEffect(() => {
    if (!latestData || !chartRef.current) return;
    // latestData.light is already inverted by Dashboard's handleSensorPush
    const val = latestData[tab.key];
    if (val === undefined || val === null) return;

    const d     = latestData.timestamp ? new Date(latestData.timestamp) : new Date();
    const label = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;

    const chart  = chartRef.current;
    const labels = chart.data.labels;
    const data   = chart.data.datasets[0].data;

    if (labels.length > 0 && labels[labels.length - 1] === label) return;

    labels.push(label);
    data.push(val);

    if (labels.length > 30) { labels.shift(); data.shift(); }

    chart.update('none');
  }, [latestData, tab.key]);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, []);

  const hasData = (initialHistory[tab.key] || []).length > 0;

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
        {!hasData && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)', zIndex: 1, borderRadius: 8,
            color: 'var(--muted)', fontSize: 13,
          }}>
            Loading sensor history…
          </div>
        )}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
