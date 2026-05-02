require('dotenv').config();
const mqtt = require('mqtt');
const readline = require('readline');

// 
process.env.PYTHONIOENCODING = 'utf-8';

// 1. Cấu hình kết nối MQTT
const brokerUrl = process.env.MQTT_HOST || 'mqtt://172.20.10.4';
const options = {
    port: parseInt(process.env.MQTT_PORT) || 3636,
    username: process.env.MQTT_USERNAME || 'tranminhvu',
    password: process.env.MQTT_PASSWORD || '123456'
};

const client = mqtt.connect(brokerUrl, options);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currentDevice = '';

function askDevice() {
    console.clear();
    console.log('=============================================');
    console.log(' BẢNG ĐIỀU KHIỂN THIẾT BỊ NGOẠI TUYẾN (CLI)');
    console.log(` Trạng thái: ${client.connected ? 'Đã kết nối Broker' : 'Đang kết nối...'}`);
    console.log('=============================================');
    console.log(' CHỌN THIẾT BỊ BẠN MUỐN ĐIỀU KHIỂN:');
    console.log(' [1] Quạt (fan)');
    console.log(' [2] Đèn (light)');
    console.log(' [3] Điều hòa (airConditioner)');
    console.log('---------------------------------------------');
    console.log(' [0] Thoát chương trình');
    console.log('=============================================');
    
    rl.question(' Nhập ID thiết bị (0-3): ', handleDeviceSelection);
}

function handleDeviceSelection(choice) {
    choice = choice.trim();
    if (choice === '1') currentDevice = 'fan';
    else if (choice === '2') currentDevice = 'light';
    else if (choice === '3') currentDevice = 'airConditioner';
    else if (choice === '0') {
        console.log('\nĐang ngắt kết nối MQTT. Tạm biệt!');
        client.end();
        rl.close();
        process.exit(0);
    } else {
        console.log('\n Lựa chọn không hợp lệ!');
        setTimeout(askDevice, 1000);
        return;
    }
    
    askAction();
}

function askAction() {
    console.log('\n---------------------------------------------');
    console.log(` BẠN MUỐN LÀM GÌ VỚI [${currentDevice.toUpperCase()}] ?`);
    console.log(' [1] Gửi lệnh BẬT (ON)');
    console.log(' [0] Gửi lệnh TẮT (OFF)');
    console.log('---------------------------------------------');
    console.log(' [9] Quay lại chọn thiết bị khác');
    
    rl.question(' Lựa chọn của bạn (1/0/9): ', (choice) => {
        choice = choice.trim();
        if (choice === '1') {
            publishControl(currentDevice, 'ON');
        } else if (choice === '0') {
            publishControl(currentDevice, 'OFF');
        } else if (choice === '9') {
            askDevice();
        } else {
            console.log('\n Lựa chọn không hợp lệ, vui lòng nhập lại!');
            setTimeout(askAction, 1000);
        }
    });
}

function publishControl(deviceName, action) {
    const payload = JSON.stringify({ device: deviceName, action: action });
    
    // Gửi lệnh ĐIỀU KHIỂN
    client.publish('iot/device/control', payload, { qos: 0, retain: false }, (err) => {
        if (err) {
            console.log(`\n Lỗi khi gửi lệnh:`, err);
        } else {
            console.log(`\n => THÀNH CÔNG gửi lệnh: [${deviceName}] -> [${action}]`);
        }
        
        // Chờ 2 giây rồi hỏi tiếp
        setTimeout(askDevice, 2000); 
    });
}

client.on('connect', () => {
    askDevice();
});

client.on('error', (err) => {
    console.log('\nLỗi MQTT:', err.message);
    process.exit(1);
});
