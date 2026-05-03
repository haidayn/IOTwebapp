// Thu thập dữ liệu & Điều khiển qua MQTT
// Flow: DB-Authoritative Sync — ESP yêu cầu đồng bộ khi reconnect
///////////////////////////////////////////
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

/* ================= CẤU HÌNH ĐỘNG (CHỈ NHẬP QUA SERIAL) ================= */
String wifi_ssid = "";
String wifi_pass = "";

String mqtt_server = "";
int    mqtt_port   = 0;
String mqtt_user   = "";
String mqtt_pass   = "";

/* ================= MQTT TOPICS ================= */
#define MQTT_TOPIC_DATA    "iot/sensor/data"
#define MQTT_TOPIC_CONTROL "iot/device/control"
#define MQTT_TOPIC_STATUS  "iot/device/status"
#define MQTT_TOPIC_SYNC    "iot/device/sync"   // Kênh đồng bộ 2 chiều với DB

/* ================= PIN & SENSOR ================= */
#define DHT_PIN  4   // GPIO4  D2
#define LDR_PIN  5   // GPIO5  D1

#define LED_TEMP 14  // ID: 1 - Quạt (Fan) - D5
#define LED_HUM  12  // ID: 2 - Điều hòa (Air) - D6
#define LED_LDR  13  // ID: 3 - Đèn (Light) - D7

#define DHTTYPE DHT11

DHT          dht(DHT_PIN, DHTTYPE);
WiFiClient   espClient;
PubSubClient mqttClient(espClient);

/* ================= BIẾN QUẢN LÝ THỜI GIAN ================= */
unsigned long lastRead             = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastWiFiAttempt      = 0;

/* ================= HÀM KẾT NỐI WIFI ================= */
void connectWiFi() {
  if (wifi_ssid == "") {
    Serial.println("\n[SKIP] Chua co thong tin WiFi. Nhap qua Serial de tiep tuc.");
    return;
  }

  Serial.print("\nConnecting WiFi: ");
  Serial.println(wifi_ssid);

  WiFi.disconnect();
  delay(100);
  WiFi.mode(WIFI_STA);

  if (wifi_pass == "")
    WiFi.begin(wifi_ssid.c_str());
  else
    WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());

  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 40) {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[SKIP] WiFi Timeout! Bo qua ket noi mang.");
  }
}

/* ================= HÀM GỬI PHẢN HỒI ================= */
void sendResponse(String device, String action) {
  StaticJsonDocument<200> doc;
  doc["device"] = device;
  doc["action"] = action;
  doc["status"] = "success";

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
  Serial.println("[MQTT PUB] Response: " + payload);
}

void sendError(String message) {
  StaticJsonDocument<200> doc;
  doc["error"] = message;

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
  Serial.println("[MQTT PUB] Error: " + payload);
}

/* ================= ÁP DỤNG TRẠNG THÁI ĐỒNG BỘ TỪ DB ================= */
// Payload nhận từ backend: {"fan":1,"air":0,"light":1}  (1=ON, 0=OFF)
void applySyncState(StaticJsonDocument<256>& doc) {
  Serial.println("[SYNC] Ap dung trang thai tu DB...");

  bool anyApplied = false;

  if (doc.containsKey("fan")) {
    int s = doc["fan"].as<int>();
    digitalWrite(LED_TEMP, s ? HIGH : LOW);
    Serial.println("[SYNC]   fan   -> " + String(s ? "ON" : "OFF"));
    anyApplied = true;
  }
  if (doc.containsKey("air")) {
    int s = doc["air"].as<int>();
    digitalWrite(LED_HUM, s ? HIGH : LOW);
    Serial.println("[SYNC]   air   -> " + String(s ? "ON" : "OFF"));
    anyApplied = true;
  }
  if (doc.containsKey("light")) {
    int s = doc["light"].as<int>();
    digitalWrite(LED_LDR, s ? HIGH : LOW);
    Serial.println("[SYNC]   light -> " + String(s ? "ON" : "OFF"));
    anyApplied = true;
  }

  if (!anyApplied) {
    Serial.println("[SYNC] Khong co key hop le trong payload sync.");
    return;
  }

  // Gửi xác nhận lại cho backend qua TOPIC_STATUS
  StaticJsonDocument<64> ack;
  ack["sync"] = "applied";
  String ackStr;
  serializeJson(ack, ackStr);
  mqttClient.publish(MQTT_TOPIC_STATUS, ackStr.c_str());
  Serial.println("[SYNC] Da xac nhan voi backend: " + ackStr);
}

/* ================= KẾT NỐI MQTT ================= */
boolean reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED || mqtt_server == "")
    return false;

  Serial.print("[MQTT] Dang ket noi toi " + mqtt_server + "...");
  String clientId = "ESP8266-" + String(ESP.getChipId());

  if (mqttClient.connect(clientId.c_str(), mqtt_user.c_str(), mqtt_pass.c_str())) {
    Serial.println(" [OK]");

    // Subscribe các topic cần thiết
    mqttClient.subscribe(MQTT_TOPIC_CONTROL);
    mqttClient.subscribe(MQTT_TOPIC_SYNC);   // Lắng nghe trạng thái đồng bộ từ DB

    // Gửi yêu cầu đồng bộ ngay khi vừa kết nối thành công
    StaticJsonDocument<64> syncReq;
    syncReq["request"] = "sync";
    String syncStr;
    serializeJson(syncReq, syncStr);
    mqttClient.publish(MQTT_TOPIC_SYNC, syncStr.c_str());
    Serial.println("[SYNC] Da gui yeu cau dong bo trang thai toi backend.");

    return true;
  } else {
    Serial.println(" [SKIP] Loi hoac Timeout.");
    return false;
  }
}

/* ================= CẤU HÌNH QUA SERIAL TERMINAL ================= */
void handleSerialConfig() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.startsWith("wifi: ")) {
      String data = cmd.substring(6);
      data.trim();
      int slash = data.indexOf('/');

      if (slash > 0) {
        wifi_ssid = data.substring(0, slash);
        wifi_pass = data.substring(slash + 1);
        wifi_ssid.trim();
        wifi_pass.trim();
        Serial.println("\n[CFG] Cap nhat WiFi: " + wifi_ssid);
        connectWiFi();
      } else {
        Serial.println("[ERR] Sai format! Mau: wifi: [ssid]/[pass]");
      }
    } else if (cmd.startsWith("mqtt: ")) {
      String data = cmd.substring(6);
      data.trim();

      int slash1 = data.indexOf('/');
      int slash2 = data.indexOf('/', slash1 + 1);
      int slash3 = data.indexOf('/', slash2 + 1);

      if (slash1 > 0 && slash2 > 0 && slash3 > 0) {
        mqtt_server = data.substring(0, slash1);
        mqtt_port   = data.substring(slash1 + 1, slash2).toInt();
        mqtt_user   = data.substring(slash2 + 1, slash3);
        mqtt_pass   = data.substring(slash3 + 1);

        mqtt_server.trim();
        mqtt_user.trim();
        mqtt_pass.trim();
        Serial.println("\n[CFG] Cap nhat MQTT: " + mqtt_server + ":" + String(mqtt_port));

        mqttClient.setServer(mqtt_server.c_str(), mqtt_port);
        if (mqttClient.connected())
          mqttClient.disconnect();
        lastReconnectAttempt = 0;
      } else {
        Serial.println("[ERR] Sai format! Mau: mqtt: [dns]/[port]/[user]/[pass]");
      }
    }
  }
}

/* ================= XỬ LÝ LỆNH TỪ MQTT ================= */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];
  msg.trim();

  Serial.print("\n[MQTT REC] Topic: ");
  Serial.print(topic);
  Serial.print(" | Payload: ");
  Serial.println(msg);

  // ── Xử lý SYNC — Backend trả về trạng thái đầy đủ từ DB ──────────────────
  if (String(topic) == MQTT_TOPIC_SYNC) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, msg);

    if (err) {
      Serial.println("[SYNC] Loi parse JSON: " + String(err.c_str()));
      return;
    }

    // Bỏ qua nếu là sync request do chính ESP publish (echo lại)
    if (doc.containsKey("request")) {
      Serial.println("[SYNC] Bo qua: echo cua sync request tu chinh minh.");
      return;
    }

    // Payload hợp lệ từ backend → áp dụng trạng thái
    applySyncState(doc);
    return;
  }

  // ── Xử lý CONTROL — Lệnh điều khiển đơn lẻ từ Dashboard ─────────────────
  if (String(topic) == MQTT_TOPIC_CONTROL) {
    int    ledId  = -1;
    String action = "";

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, msg);

    if (!err) {
      // JSON format: {"led":1,"status":"on"}
      if (doc["led"].is<const char*>()) {
        String value = doc["led"].as<String>();
        if (value == "all") ledId = 0;
      } else {
        ledId = doc["led"];
      }
      action = doc["status"].as<String>();
    } else {
      // Fallback plain-text: "led:1,status:on"
      msg.replace("{", "");
      msg.replace("}", "");
      msg.replace("\"", "");
      msg.replace(" ", "");

      int comma = msg.indexOf(",");
      if (comma != -1) {
        String part1 = msg.substring(0, comma);
        String part2 = msg.substring(comma + 1);

        int colon1 = part1.indexOf(":");
        if (colon1 != -1) {
          String value = part1.substring(colon1 + 1);
          if (value == "all") ledId = 0;
          else                ledId = value.toInt();
        }
        int colon2 = part2.indexOf(":");
        if (colon2 != -1)
          action = part2.substring(colon2 + 1);
      }
    }

    action.toLowerCase();

    // Validation
    if (action != "on" && action != "off") {
      sendError("invalid action");
      return;
    }
    if (ledId < 0 || ledId > 3) {
      sendError("unknown device");
      return;
    }

    // Thực thi lệnh & phản hồi
    String deviceName = "";
    int    pinState   = (action == "on") ? HIGH : LOW;

    if (ledId == 0) {
      deviceName = "all";
      digitalWrite(LED_TEMP, pinState);
      digitalWrite(LED_HUM,  pinState);
      digitalWrite(LED_LDR,  pinState);
    } else {
      deviceName = "led " + String(ledId);
      if      (ledId == 1) digitalWrite(LED_TEMP, pinState);
      else if (ledId == 2) digitalWrite(LED_HUM,  pinState);
      else if (ledId == 3) digitalWrite(LED_LDR,  pinState);
    }

    sendResponse(deviceName, action);
  }
}

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);

  pinMode(LED_TEMP, OUTPUT);
  pinMode(LED_HUM,  OUTPUT);
  pinMode(LED_LDR,  OUTPUT);
  pinMode(LDR_PIN,  INPUT);

  // Tắt tất cả khi khởi động — chờ lệnh sync từ DB
  digitalWrite(LED_TEMP, LOW);
  digitalWrite(LED_HUM,  LOW);
  digitalWrite(LED_LDR,  LOW);

  Serial.println("\n[SYS] Dang khoi dong...");

  // Blink 3 lần báo hiệu
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_TEMP, HIGH);
    digitalWrite(LED_HUM,  HIGH);
    digitalWrite(LED_LDR,  HIGH);
    delay(300);
    digitalWrite(LED_TEMP, LOW);
    digitalWrite(LED_HUM,  LOW);
    digitalWrite(LED_LDR,  LOW);
    delay(300);
  }

  dht.begin();
  mqttClient.setCallback(mqttCallback);

  Serial.println("\n--- He thong san sang ---");
  Serial.println("De doi WiFi nhap : wifi: [ssid]/[pass]");
  Serial.println("De doi MQTT nhap : mqtt: [server]/[port]/[user]/[pass]");
  Serial.println("[INFO] Sau khi ket noi MQTT, ESP tu dong yeu cau dong bo trang thai tu DB.");

  connectWiFi();
}

/* ================= VÒNG LẶP CHÍNH ================= */
void loop() {
  handleSerialConfig();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifi_ssid != "" && millis() - lastWiFiAttempt > 30000) {
      lastWiFiAttempt = millis();
      connectWiFi();
    }
  } else {
    if (!mqttClient.connected()) {
      if (mqtt_server != "" && millis() - lastReconnectAttempt > 15000) {
        lastReconnectAttempt = millis();
        reconnectMQTT();
      }
    } else {
      mqttClient.loop();
    }
  }

  // Đọc & gửi dữ liệu cảm biến mỗi 2 giây
  if (millis() - lastRead >= 2000) {
    lastRead = millis();

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int   lightState = (digitalRead(LDR_PIN) == HIGH) ? 1 : 0;

    if (isnan(h) || isnan(t))
      return;

    if (mqttClient.connected()) {
      StaticJsonDocument<256> docData;
      docData["temp"] = t;
      docData["hum"]  = h;
      docData["ldr"]  = lightState;

      char dataBuffer[256];
      serializeJson(docData, dataBuffer);
      mqttClient.publish(MQTT_TOPIC_DATA, dataBuffer);
    }
  }
}