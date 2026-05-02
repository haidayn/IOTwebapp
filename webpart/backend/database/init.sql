-- ============================================================
-- IoT Dashboard - Database Initialization Script
-- Schema: Device, DeviceAction, Sensor, SensorData
-- ============================================================

-- Tạo database nếu chưa có
CREATE DATABASE IF NOT EXISTS iot_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iot_dashboard;

-- ============================================================
-- Bảng Device: Lưu danh sách thiết bị
-- ============================================================
CREATE TABLE IF NOT EXISTS Device (
    ID         INT(10)      NOT NULL AUTO_INCREMENT,
    name       VARCHAR(255) NOT NULL,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Bảng DeviceAction: Lịch sử hành động thiết bị
-- ============================================================
CREATE TABLE IF NOT EXISTS DeviceAction (
    ID         INT(10)      NOT NULL AUTO_INCREMENT,
    deviceID   INT(10)      NOT NULL,
    action     VARCHAR(255) NOT NULL,         -- 'ON' | 'OFF'
    status     VARCHAR(255) NOT NULL DEFAULT 'success',
    running    INT(10)      NOT NULL DEFAULT 0, -- 1 = đang chạy, 0 = đã dừng
    date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    INDEX idx_DeviceAction_deviceID (deviceID),
    INDEX idx_DeviceAction_date (date),
    CONSTRAINT fk_DeviceAction_Device
        FOREIGN KEY (deviceID) REFERENCES Device(ID)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Bảng Sensor: Danh sách cảm biến
-- ============================================================
CREATE TABLE IF NOT EXISTS Sensor (
    ID         INT(10)      NOT NULL AUTO_INCREMENT,
    name       VARCHAR(255) NOT NULL,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Bảng SensorData: Dữ liệu đo từ cảm biến
-- ============================================================
CREATE TABLE IF NOT EXISTS SensorData (
    ID         INT(10)      NOT NULL AUTO_INCREMENT,
    SensorID   INT(10)      NOT NULL,
    value      DOUBLE       NOT NULL,
    date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    INDEX idx_SensorData_SensorID (SensorID),
    INDEX idx_SensorData_date (date),
    CONSTRAINT fk_SensorData_Sensor
        FOREIGN KEY (SensorID) REFERENCES Sensor(ID)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed data ban đầu
-- ============================================================

-- 3 thiết bị (khớp với FE)
INSERT IGNORE INTO Device (ID, name, createAt) VALUES
(1, 'fan',            NOW()),
(2, 'airConditioner', NOW()),
(3, 'light',          NOW());

-- Insert Sensors (3 cảm biến giống FE)
INSERT IGNORE INTO Sensor (ID, name, createAt) VALUES
(1, 'temperature', NOW()),
(2, 'humidity',    NOW()),
(3, 'light',       NOW());

SELECT 'Database iot_dashboard initialized successfully!' AS message;
SELECT 'Tables: Device, DeviceAction, Sensor, SensorData' AS tables_created;
