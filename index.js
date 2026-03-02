// ✅ كود الخادم الكامل
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const clientsDB = new Map();

function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

function encryptData(data, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(encryptedData, key) {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  const parts = encryptedData.split(':');
  if (parts.length < 2) throw new Error('صيغة غير صالحة');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.length === 3 ? parts[2] : parts[1];
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

app.get('/', (req, res) => {
  res.json({ success: true, message: '🖥️ Server is running', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'healthy', uptime: process.uptime() });
});

app.post('/api/clients/register', (req, res) => {
  try {    const { clientId, deviceInfo } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId مطلوب' });
    }
    const deviceId = crypto.randomUUID();
    const encryptionKey = generateEncryptionKey();
    clientsDB.set(deviceId, { deviceId, clientId, encryptionKey, deviceInfo, registeredAt: new Date() });
    console.log(`✅ جهاز جديد: ${deviceId}`);
    res.json({ success: true, deviceId, encryptionKey, message: 'تم التسجيل بنجاح' });
  } catch (error) {
    console.error('❌ خطأ في التسجيل:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clients/checkin', (req, res) => {
  try {
    const { deviceId, encryptedData } = req.body;
    if (!deviceId || !encryptedData) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }
    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'الجهاز غير مسجل' });
    }
    const decrypted = decryptData(encryptedData, client.encryptionKey);
    console.log(`📡 Check-in من: ${deviceId}`);
    client.lastCheckIn = new Date();
    clientsDB.set(deviceId, client);
    const responseData = { commands: [] };
    const encryptedResponse = encryptData(responseData, client.encryptionKey);
    res.json({ success: true, encryptedData: encryptedResponse });
  } catch (error) {
    console.error('❌ خطأ في check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clients/report', (req, res) => {
  try {
    const { deviceId } = req.body;
    console.log(`📊 تقرير من: ${deviceId}`);
    res.json({ success: true, message: 'تم استلام التقرير' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/devices', (req, res) => {
  const devices = Array.from(clientsDB.values()).map(c => ({    deviceId: c.deviceId,
    clientId: c.clientId,
    status: c.lastCheckIn ? 'active' : 'inactive',
    lastCheckIn: c.lastCheckIn,
  }));
  res.json({ success: true, count: devices.length, devices });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
