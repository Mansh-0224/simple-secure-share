require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { readDb, withDb } = require('./db');
const { encryptBuffer, decryptBuffer, sha256Hex, randomToken } = require('./crypto-utils');
const { authenticate } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

function publicFile(file) {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'email, password, and name are all required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const result = await withDb(async (db) => {
      const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        throw Object.assign(new Error('An account with this email already exists'), { status: 409 });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        id: uuidv4(),
        email: email.toLowerCase(),
        passwordHash,
        name,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      return user;
    });

    res.status(201).json({ success: true, data: { user: publicUser(result) } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }

  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.json({ success: true, data: { token, user: publicUser(user) } });
});

app.get('/api/me', authenticate, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: { user: publicUser(user) } });
});

// ---------------------------------------------------------------------------
// File routes
// ---------------------------------------------------------------------------

app.post('/api/files/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided (form field "file")' });
  }

  try {
    const { originalname, mimetype, buffer } = req.file;
    const checksum = sha256Hex(buffer);
    const storedName = `${uuidv4()}.enc`;
    const encrypted = encryptBuffer(buffer);
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), encrypted, { mode: 0o600 });

    const file = await withDb((db) => {
      const record = {
        id: uuidv4(),
        ownerId: req.userId,
        originalName: originalname,
        storedName,
        mimeType: mimetype,
        size: buffer.length,
        checksum,
        createdAt: new Date().toISOString(),
      };
      db.files.push(record);
      return record;
    });

    res.status(201).json({ success: true, data: { file: publicFile(file) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
});

app.get('/api/files', authenticate, (req, res) => {
  const db = readDb();
  const files = db.files.filter((f) => f.ownerId === req.userId);
  res.json({ success: true, data: { files: files.map(publicFile) } });
});

app.get('/api/files/:id/download', authenticate, (req, res) => {
  const db = readDb();
  const file = db.files.find((f) => f.id === req.params.id && f.ownerId === req.userId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  try {
    const encrypted = fs.readFileSync(path.join(UPLOAD_DIR, file.storedName));
    const decrypted = decryptBuffer(encrypted);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(decrypted);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to decrypt file' });
  }
});

app.delete('/api/files/:id', authenticate, async (req, res) => {
  const db = readDb();
  const file = db.files.find((f) => f.id === req.params.id && f.ownerId === req.userId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  await withDb((db2) => {
    db2.files = db2.files.filter((f) => f.id !== req.params.id);
    db2.shares = db2.shares.filter((s) => s.fileId !== req.params.id);
  });

  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, file.storedName));
  } catch (err) {
    /* ignore if already gone */
  }

  res.json({ success: true, message: 'File deleted' });
});

// ---------------------------------------------------------------------------
// Share link routes
// ---------------------------------------------------------------------------

app.post('/api/share', authenticate, async (req, res) => {
  const { fileId, password, expiresInHours, maxDownloads } = req.body || {};

  const db = readDb();
  const file = db.files.find((f) => f.id === fileId && f.ownerId === req.userId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  const token = randomToken(16);
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const hours = Number(expiresInHours) > 0 ? Number(expiresInHours) : 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const share = await withDb((db2) => {
    const record = {
      id: uuidv4(),
      fileId,
      token,
      passwordHash,
      expiresAt,
      maxDownloads: maxDownloads ? Number(maxDownloads) : null,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };
    db2.shares.push(record);
    return record;
  });

  res.status(201).json({
    success: true,
    data: {
      id: share.id,
      token: share.token,
      shareUrl: `${req.protocol}://${req.get('host')}/share.html?token=${share.token}`,
      expiresAt: share.expiresAt,
      hasPassword: !!passwordHash,
    },
  });
});

app.get('/api/share/:token', (req, res) => {
  const db = readDb();
  const share = db.shares.find((s) => s.token === req.params.token);
  if (!isShareValid(share)) {
    return res.status(404).json({ success: false, message: 'This link is invalid, expired, or has been revoked' });
  }
  const file = db.files.find((f) => f.id === share.fileId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  res.json({
    success: true,
    data: {
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      requiresPassword: !!share.passwordHash,
    },
  });
});

app.post('/api/share/:token/download', async (req, res) => {
  const db = readDb();
  const share = db.shares.find((s) => s.token === req.params.token);
  if (!isShareValid(share)) {
    return res.status(404).json({ success: false, message: 'This link is invalid, expired, or has been revoked' });
  }

  if (share.passwordHash) {
    const password = (req.body || {}).password || '';
    const valid = await bcrypt.compare(password, share.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Incorrect or missing password' });
    }
  }

  const file = db.files.find((f) => f.id === share.fileId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  try {
    const encrypted = fs.readFileSync(path.join(UPLOAD_DIR, file.storedName));
    const decrypted = decryptBuffer(encrypted);

    await withDb((db2) => {
      const s = db2.shares.find((x) => x.id === share.id);
      if (s) s.downloadCount += 1;
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(decrypted);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to decrypt file' });
  }
});

app.delete('/api/share/:id', authenticate, async (req, res) => {
  const db = readDb();
  const share = db.shares.find((s) => s.id === req.params.id);
  if (!share) return res.status(404).json({ success: false, message: 'Share link not found' });
  const file = db.files.find((f) => f.id === share.fileId && f.ownerId === req.userId);
  if (!file) return res.status(403).json({ success: false, message: 'Not authorized' });

  await withDb((db2) => {
    db2.shares = db2.shares.filter((s) => s.id !== req.params.id);
  });
  res.json({ success: true, message: 'Share link revoked' });
});

function isShareValid(share) {
  if (!share) return false;
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return false;
  if (share.maxDownloads && share.downloadCount >= share.maxDownloads) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Health check + startup
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptimeSeconds: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Simple Secure Share running at http://localhost:${PORT}`);
});
