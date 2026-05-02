-- ============================================================
-- IoT Dashboard - Schema: tạo bảng (không có CREATE DATABASE / USE)
-- Chạy sau khi đã kết nối vào database iot_dashboard
-- ============================================================

-- Bảng Device (phải tạo trước DeviceAction)
CREATE TABLE IF NOT EXISTS Device (
    ID         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(255) NOT NULL,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng DeviceAction (FK → Device)
CREATE TABLE IF NOT EXISTS DeviceAction (
    ID         INT          NOT NULL AUTO_INCREMENT,
    deviceID   INT          NOT NULL,
    action     VARCHAR(255) NOT NULL,
    status     VARCHAR(255) NOT NULL DEFAULT 'success',
    running    INT          NOT NULL DEFAULT 0,
    date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    INDEX idx_deviceID (deviceID),
    INDEX idx_date (date),
    CONSTRAINT fk_DeviceAction_Device
        FOREIGN KEY (deviceID) REFERENCES Device(ID)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng Sensor (phải tạo trước SensorData)
CREATE TABLE IF NOT EXISTS Sensor (
    ID         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(255) NOT NULL,
    createAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng SensorData (FK → Sensor)
CREATE TABLE IF NOT EXISTS SensorData (
    ID         INT          NOT NULL AUTO_INCREMENT,
    SensorID   INT          NOT NULL,
    value      DOUBLE       NOT NULL,
    date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    INDEX idx_SensorID (SensorID),
    INDEX idx_date (date),
    CONSTRAINT fk_SensorData_Sensor
        FOREIGN KEY (SensorID) REFERENCES Sensor(ID)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data ban đầu (INSERT IGNORE: bỏ qua nếu đã tồn tại)
INSERT IGNORE INTO Device (ID, name, createAt) VALUES
(1, 'fan',            NOW()),
(2, 'airConditioner', NOW()),
(3, 'light',          NOW());

INSERT IGNORE INTO Sensor (ID, name, createAt) VALUES
(1, 'temperature', NOW()),
(2, 'humidity',    NOW()),
(3, 'light',       NOW())
