import { useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:3001`;
const RECONNECT_DELAY = 3000;

/**
 * Custom hook để kết nối WebSocket với backend.
 * @param {function} onSensorData  - callback({ temperature, humidity, light, timestamp })
 * @param {function} onDeviceUpdate - callback({ device, is_on })
 */
export default function useWebSocket(onSensorData, onDeviceUpdate) {
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const mountedRef   = useRef(true);

  const sensorCb = useRef(onSensorData);
  const deviceCb = useRef(onDeviceUpdate);
  useEffect(() => { sensorCb.current = onSensorData; }, [onSensorData]);
  useEffect(() => { deviceCb.current = onDeviceUpdate; }, [onDeviceUpdate]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'sensor' && sensorCb.current) {
          sensorCb.current(msg.payload);
        } else if (msg.type === 'device' && deviceCb.current) {
          deviceCb.current(msg.payload);
        }
      } catch {
        console.warn('[WS] Failed to parse message:', evt.data);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected — reconnecting in', RECONNECT_DELAY, 'ms');
      if (mountedRef.current) {
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);
}
